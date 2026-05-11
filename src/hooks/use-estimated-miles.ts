"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { RPC_ENDPOINT } from "@/lib/network-config"

/** Fallback average gas limit for bid cost calculation (priorityFee × gasLimit) */
const DEFAULT_AVG_GAS_LIMIT = 450_000n
/** Fallback average gas used for gas cost calculation on permit path (baseFee × gasUsed) */
const DEFAULT_AVG_GAS_USED = 180_000n
/**
 * Fallback priority fee in wei (≈ 0.06 gwei). Matches the rough median value
 * `mevcommit_estimateBidPricePerGas` returns under normal conditions. Used as
 * the initial state so the forward calc can produce miles immediately on the
 * first quote — without it, miles flash "TBD" for the duration of the first
 * FastRPC poll roundtrip, which feels like the calc is hanging on cold load.
 */
const DEFAULT_PRIORITY_FEE_WEI = 60_000_000n // 0.06 gwei
/** User receives 90% of captured MEV */
const USER_MEV_SHARE = 0.9
/** 100,000 miles per 1 ETH (0.00001 ETH per mile) */
const MILES_PER_ETH = 100_000
/** How often to refresh bid estimate from FastRPC (ms) — roughly 1 block */
const BID_ESTIMATE_POLL_MS = 12_000
/**
 * Default ceiling the calculator's slippage planner is allowed to propose, in
 * percent. Used until Edge Config (`miles_calc_max_slippage_pct`) loads and
 * as the offline fallback in tests. Mirrors the route default in
 * `src/app/api/config/gas-estimate/route.ts`.
 */
export const DEFAULT_MILES_CALC_MAX_SLIPPAGE_PCT = 50
/** Tolerance above the cap to forgive FLOOR_EPSILON drift when target equals
 *  `maxAchievableMiles`. Anything beyond this is a real over-target. */
export const MILES_CALC_SLIPPAGE_TOLERANCE_PCT = 0.5

/**
 * Compute the on-chain surplus (in ETH) the FastSettlement contract would
 * retain from this trade, given Barter's pre-gas routed output and the user's
 * slippage tolerance.
 *
 *   userAmtOut   = uniswapAmountOut × (1 − slippage / 100)
 *   surplus_tok  = max(0, barterPreGas − userAmtOut)
 *   surplus_eth  = surplus_tok converted to ETH (using prices on non-ETH output)
 *
 * Returns `null` when inputs are invalid or insufficient — caller should fall
 * back to the Edge Config rate-based formula in that case.
 *
 * Exported for testing.
 */
export function computeSurplusEth(args: {
  parsedAmountOut: number
  slippagePct: number
  barterPreGasOutputAmount: bigint
  toTokenDecimals: number
  isEthOutput: boolean
  toTokenPrice: number | null
  ethPrice: number | null
}): number | null {
  const {
    parsedAmountOut,
    slippagePct,
    barterPreGasOutputAmount,
    toTokenDecimals,
    isEthOutput,
    toTokenPrice,
    ethPrice,
  } = args

  if (
    !Number.isFinite(parsedAmountOut) ||
    parsedAmountOut <= 0 ||
    !Number.isFinite(slippagePct) ||
    slippagePct < 0 ||
    barterPreGasOutputAmount <= 0n ||
    toTokenDecimals < 0
  ) {
    return null
  }

  const decimalsScale = 10 ** toTokenDecimals
  const barterPreGasHuman = Number(barterPreGasOutputAmount) / decimalsScale

  // Sanity gate: barter pre-gas amount should be close to the uniswap quote.
  // Real barter routing rarely deviates more than ~30% in either direction
  // even on thin liquidity. Anything outside [0.5×, 2×] is almost certainly
  // stale — typically the render right after a token-switch when
  // `barterPreGas` is still the previous pair's bigint but `toTokenDecimals`
  // has already updated. Return null and let the caller fall back to the
  // slippage approximation; the next stable observation overrides it.
  if (barterPreGasHuman < parsedAmountOut * 0.5 || barterPreGasHuman > parsedAmountOut * 2) {
    return null
  }

  const userAmtOutHuman = parsedAmountOut * (1 - slippagePct / 100)
  const surplusHuman = Math.max(0, barterPreGasHuman - userAmtOutHuman)

  if (isEthOutput) return surplusHuman

  if (toTokenPrice == null || toTokenPrice <= 0 || ethPrice == null || ethPrice <= 0) {
    return null
  }
  return (surplusHuman * toTokenPrice) / ethPrice
}
/**
 * Fallback surplus rate — used until Edge Config value is fetched.
 * Updated daily by the miles-estimate-gas cron job: p25 of
 * `surplus / user_amt_out` across all processed swaps (both eth_weth and
 * erc20→erc20) over the last 30 days. p25 rather than p50 because the
 * realized distribution is bimodal — see the cron for rationale.
 */
const DEFAULT_SURPLUS_RATE = 0.0056

interface UseEstimatedMilesParams {
  amountOut: string
  slippage: string
  /**
   * Decimals of the output token. Required to convert `barterPreGasOutputAmount`
   * (wei) to a human-readable amount for the surplus comparison.
   */
  toTokenDecimals: number | null
  /**
   * Barter's pre-gas routed output (wei). When present, drives the
   * slippage-aware surplus formula: `surplus = barterPreGasOutputAmount −
   * userAmtOut`. Mirrors what the FastSettlement contract retains as surplus
   * on-chain (see `IntentExecuted` event in FastSettlementV3).
   *
   * When undefined (Barter still validating, unavailable, or wrap/unwrap),
   * the estimator falls back to `surplusRate × outputInEth` from Edge Config
   * so the badge has a value to show.
   */
  barterPreGasOutputAmount: bigint | undefined
  toTokenPrice: number | null
  ethPrice: number | null
  isEthOutput: boolean
  baseFeePerGas: bigint | null
  isPermitPath: boolean
  enabled: boolean
  /** True while Barter validation is in flight for the current swap inputs.
   *  Used to freeze `estimatedMiles` and `maxAchievableMiles` at their last
   *  values until the new pair's data is ready, so they don't briefly
   *  compute on partially-settled props (e.g. right after a token switch). */
  isBarterValidating: boolean
  /** Identity of the user's swap inputs (typed amount + pair). Changes
   *  synchronously when the user clicks/types. Used to clear the estimator's
   *  cached miles/effective-rate refs so prior-amount values don't leak
   *  into the new amount during the validation window — critical for the
   *  percentage-button toggle case where `amountOut` lags the click. */
  swapIdentityKey: string
}

export interface MilesPlan {
  /** Slippage that achieves the target at the user's current swap size,
   *  clamped to [autoBase, 50]. May be lower OR higher than the user's
   *  current slippage — the calc proposes whatever the target requires. */
  slippage: string
  /** True iff the slippage differs from the user's current value (in either
   *  direction) — i.e. there's something to apply. */
  requiresChange: boolean
}

export interface UseEstimatedMilesReturn {
  estimatedMiles: number | null
  /**
   * Inverse of the miles formula: given a target miles count, return the
   * required output token amount (in display units) needed to earn it.
   * Returns null if gas/price data isn't loaded yet or the target is
   * below the cost floor (i.e. not earnable at current gas).
   */
  milesToAmountOut: (targetMiles: number) => number | null
  /**
   * Slippage planner. Given a target miles count, returns the slippage that
   * achieves it AT THE USER'S CURRENT SWAP SIZE (their typed `amountOut`) —
   * does NOT change the buy amount. Used by the calculator to nudge slippage
   * only. Returns null if the target can't be reached even at 50% slippage.
   */
  milesToSlippage: (targetMiles: number) => MilesPlan | null
  /**
   * Reactive: maximum miles earnable at the user's CURRENT swap size with
   * SLIPPAGE_MAX (50%) as the rate ceiling. Recomputes when amountOut,
   * prices, gas, or path changes — so the hint follows quote/gas ticks.
   */
  maxAchievableMiles: number | null
}

export function useEstimatedMiles({
  amountOut,
  slippage,
  toTokenDecimals,
  barterPreGasOutputAmount,
  toTokenPrice,
  ethPrice,
  isEthOutput,
  baseFeePerGas,
  isPermitPath,
  enabled,
  isBarterValidating,
  swapIdentityKey,
}: UseEstimatedMilesParams): UseEstimatedMilesReturn {
  const [priorityFee, setPriorityFee] = useState<bigint | null>(DEFAULT_PRIORITY_FEE_WEI)
  const [avgGasLimit, setAvgGasLimit] = useState<bigint>(DEFAULT_AVG_GAS_LIMIT)
  const [avgGasUsed, setAvgGasUsed] = useState<bigint>(DEFAULT_AVG_GAS_USED)
  const [surplusRate, setSurplusRate] = useState(DEFAULT_SURPLUS_RATE)
  const [milesCalcMaxSlippagePct, setMilesCalcMaxSlippagePct] = useState(
    DEFAULT_MILES_CALC_MAX_SLIPPAGE_PCT
  )

  // Fetch gas estimates and surplus rate from Edge Config (updated daily by cron).
  // Runs on mount — not gated on `enabled` so data is ready before the first quote arrives.
  useEffect(() => {
    let cancelled = false

    const fetchEstimates = async () => {
      try {
        const res = await fetch("/api/config/gas-estimate")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          if (typeof data.gasEstimate === "number" && data.gasEstimate > 0) {
            setAvgGasLimit(BigInt(data.gasEstimate))
          }
          if (typeof data.gasUsedEstimate === "number" && data.gasUsedEstimate > 0) {
            setAvgGasUsed(BigInt(data.gasUsedEstimate))
          }
          if (typeof data.surplusRate === "number" && data.surplusRate > 0) {
            setSurplusRate(data.surplusRate)
          }
          if (
            typeof data.milesCalcMaxSlippagePct === "number" &&
            data.milesCalcMaxSlippagePct > 0
          ) {
            setMilesCalcMaxSlippagePct(data.milesCalcMaxSlippagePct)
          }
        }
      } catch (err) {
        console.warn("[useEstimatedMiles] Failed to fetch estimates:", err)
      }
    }

    fetchEstimates()
    return () => {
      cancelled = true
    }
  }, [])

  // Poll bid estimate from FastRPC every ~12s.
  // Uses mevcommit_estimateBidPricePerGas which returns the cached blocknative
  // priority fee estimate — the same value the bidder uses for actual bids.
  useEffect(() => {
    let cancelled = false

    const fetchBidEstimate = async () => {
      try {
        const res = await fetch(RPC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "mevcommit_estimateBidPricePerGas",
            params: [],
            id: 1,
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        const minGasPrice = data?.result?.minGasPrice
        if (!cancelled && minGasPrice) {
          setPriorityFee(BigInt(minGasPrice))
        }
      } catch (err) {
        console.warn("[useEstimatedMiles] Failed to fetch bid estimate:", err)
      }
    }

    fetchBidEstimate()
    const interval = setInterval(fetchBidEstimate, BID_ESTIMATE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Snapshot gas data in refs so the memo only recalculates on user-driven changes
  // (amountOut, slippage), not on background 12s gas fee ticks.
  const priorityFeeRef = useRef<bigint | null>(null)
  const baseFeeRef = useRef<bigint | null>(null)
  const avgGasLimitRef = useRef<bigint>(DEFAULT_AVG_GAS_LIMIT)
  const avgGasUsedRef = useRef<bigint>(DEFAULT_AVG_GAS_USED)
  const surplusRateRef = useRef(DEFAULT_SURPLUS_RATE)
  const milesCalcMaxSlippagePctRef = useRef(DEFAULT_MILES_CALC_MAX_SLIPPAGE_PCT)
  priorityFeeRef.current = priorityFee
  baseFeeRef.current = baseFeePerGas
  avgGasLimitRef.current = avgGasLimit
  avgGasUsedRef.current = avgGasUsed
  surplusRateRef.current = surplusRate
  milesCalcMaxSlippagePctRef.current = milesCalcMaxSlippagePct

  // Track last successful miles so transient states don't flash null.
  const lastMilesRef = useRef<number | null>(null)
  // Snapshot of the forward calc's effective surplus rate
  // (slippageAmountEth / outputInEth) on its last successful run. The inverse
  // uses this so it matches the forward at the current operating point —
  // particularly when barter routing differs from `slippage/100`.
  const lastEffectiveSurplusRateRef = useRef<number | null>(null)

  // Clear both refs the moment the swap identity changes. Driven by the
  // user's typed amount + pair (passed in via `swapIdentityKey`) rather than
  // `amountOut`, because `amountOut` lags the click — it only updates when
  // the new quote refetches. With the lagging signal, toggling 50% → 25%
  // briefly leaves these refs holding the prior amount's values, which the
  // inverse calc then uses to project a wildly inflated slippage (visible
  // as "50% slippage + high miles"). The synchronous identity key clears
  // them on the click itself, so the validation gate falls through to a
  // genuine empty state until fresh values arrive.
  const lastIdentityKeyRef = useRef<string>(swapIdentityKey)
  if (lastIdentityKeyRef.current !== swapIdentityKey) {
    lastIdentityKeyRef.current = swapIdentityKey
    lastMilesRef.current = null
    lastEffectiveSurplusRateRef.current = null
  }

  // Whether gas data has loaded at least once — triggers one recalc when it arrives.
  // Only require baseFeePerGas on the permit path — the ETH path doesn't use
  // it, so blocking on its initial null would needlessly delay the first
  // miles render. priorityFee has a default so it's already non-null on mount.
  const gasReady = priorityFee != null && (!isPermitPath || baseFeePerGas != null)

  // Synchronous calculation — updates in the same render as slippage/amountOut changes.
  // gasReady is a dep so we recalculate once when gas data first arrives, but subsequent
  // gas fee ticks (every 12s) are read from refs and don't trigger recalculation.
  const rawMiles = useMemo(() => {
    if (!enabled) return null
    // Don't compute miles while barter is in flight — return null so the
    // last-good value (kept in `lastMilesRef`) is shown instead. Avoids
    // flashing a fallback value during the transition before all inputs
    // for the new pair have settled.
    if (isBarterValidating) return null

    const normalizedAmountOut = amountOut?.replace(/,/g, "") ?? ""
    const curPriorityFee = priorityFeeRef.current
    const curBaseFee = baseFeeRef.current
    const curAvgGasLimit = avgGasLimitRef.current
    const curAvgGasUsed = avgGasUsedRef.current
    if (curPriorityFee == null) return null
    if (isPermitPath && curBaseFee == null) return null

    const parsedAmountOut = parseFloat(normalizedAmountOut)
    if (!parsedAmountOut || parsedAmountOut <= 0) return 0

    // Convert output amount to ETH
    let outputInEth: number
    if (isEthOutput) {
      outputInEth = parsedAmountOut
    } else {
      if (toTokenPrice == null || toTokenPrice <= 0 || !ethPrice || ethPrice <= 0) {
        return null
      }
      outputInEth = (parsedAmountOut * toTokenPrice) / ethPrice
    }

    // MEV pot in ETH.
    //
    // Preferred path — use the slippage-aware surplus formula, mirroring what
    // the FastSettlement contract retains on-chain:
    //   surplus = barterPreGasOutputAmount − userAmtOut
    //   userAmtOut = uniswapAmountOut × (1 − slippage / 100)
    // The contract's `received - userAmtOut` becomes the surplus that's later
    // credited to the user as miles. Computing the same quantity from Barter's
    // pre-gas routing output gives a slippage-reactive estimate without any
    // capture-rate cap or hand-tuned constant.
    //
    // Fallback path — when Barter hasn't settled yet, is unavailable, or the
    // output decimals are unknown, fall back to `surplusRate × outputInEth`
    // from Edge Config so the badge still shows a number.
    const curSurplusRate = surplusRateRef.current
    const slippagePct = parseFloat(slippage)
    let slippageAmountEth: number
    let formulaSource: "barter-surplus" | "edge-config-fallback"
    const surplusFromBarter =
      barterPreGasOutputAmount != null && toTokenDecimals != null
        ? computeSurplusEth({
            parsedAmountOut,
            slippagePct,
            barterPreGasOutputAmount,
            toTokenDecimals,
            isEthOutput,
            toTokenPrice,
            ethPrice,
          })
        : null
    if (surplusFromBarter != null) {
      slippageAmountEth = surplusFromBarter
      formulaSource = "barter-surplus"
    } else {
      slippageAmountEth = curSurplusRate * outputInEth
      formulaSource = "edge-config-fallback"
    }

    // Bid cost: priority fee × avg gas limit (bid = priorityFee × txn.Gas())
    const bidCostEth = Number(curPriorityFee * curAvgGasLimit) / 1e18

    // Gas cost: only deducted on permit path (relayer pays actual gas used, not limit)
    const gasCostEth = isPermitPath ? Number(curBaseFee * curAvgGasUsed) / 1e18 : 0

    // Sweep overhead: non-ETH output requires a sweep tx (batched fastswap).
    // 2.5x is a conservative proxy — batches are effectively size-1 at current
    // volume, so each user eats the whole sweep gas share. Daily p50 of
    // realized (bid + overhead) / bid varies widely (0.9–2.9 over the last
    // 10 days), so any fixed multiplier is a bandaid. 2.5 covers the median
    // of "bad" days (p50 ≈ 1.9) while staying tolerable on cheap days.
    // TODO: replace with an Edge Config-driven sweep overhead term computed
    // from `surplus_eth - net_profit_eth - bid_cost` on recent finalized rows
    // — same pattern as `miles_estimate_surplus_rate`.
    const sweepMultiplier = isEthOutput ? 1 : 2.5
    const totalBidCost = bidCostEth * sweepMultiplier
    const totalGasCost = gasCostEth * sweepMultiplier

    // Snapshot the effective surplus rate so the inverse calculator can use
    // the SAME rate the forward just produced (especially when barter's
    // pre-gas output diverges from `slippage/100 × outputInEth`).
    if (outputInEth > 0) {
      lastEffectiveSurplusRateRef.current = slippageAmountEth / outputInEth
    }

    const netMevEth = slippageAmountEth - totalBidCost - totalGasCost

    const userMevEth = netMevEth > 0 ? netMevEth * USER_MEV_SHARE : 0
    const miles = netMevEth > 0 ? Math.floor(userMevEth * MILES_PER_ETH) : 0

    console.log(
      `[useEstimatedMiles] ${miles} miles | ${isPermitPath ? "permit" : "ETH"} path | source=${formulaSource}\n` +
        `\n` +
        `  Step 1: Convert output to ETH\n` +
        (isEthOutput
          ? `    outputInEth = ${parsedAmountOut} (native ETH output)\n`
          : `    outputInEth = ${parsedAmountOut} × $${toTokenPrice?.toFixed(2)} / $${ethPrice?.toFixed(2)} = ${outputInEth.toFixed(6)} ETH\n`) +
        `\n` +
        (formulaSource === "barter-surplus"
          ? `  Step 2: MEV pot (slippage-aware: barterPreGas − userAmtOut)\n` +
            `    slippage = ${slippagePct}%\n` +
            `    userAmtOut = ${parsedAmountOut} × (1 − ${slippagePct}/100)\n` +
            `    slippageAmountEth = ${slippageAmountEth.toFixed(8)} ETH\n`
          : `  Step 2: MEV pot (Edge Config fallback: surplusRate × output)\n` +
            `    slippageAmountEth = ${outputInEth.toFixed(6)} × ${curSurplusRate} = ${slippageAmountEth.toFixed(8)} ETH\n`) +
        `\n` +
        `  Step 3: Bid cost (FastRPC bid estimate × avgGasLimit from Edge Config)\n` +
        `    bidCostEth = ${curPriorityFee.toString()} wei × ${curAvgGasLimit.toString()} gasLimit / 1e18 = ${bidCostEth.toFixed(8)} ETH\n` +
        `\n` +
        `  Step 4: Gas cost${isPermitPath ? " (relayer pays actual gasUsed on permit path)" : " (user pays on ETH path = 0)"}\n` +
        `    gasCostEth = ${isPermitPath ? `${curBaseFee.toString()} wei × ${curAvgGasUsed.toString()} gasUsed / 1e18 = ` : ""}${gasCostEth.toFixed(8)} ETH\n` +
        (!isEthOutput
          ? `\n  Step 4b: Sweep overhead (non-ETH output, ${sweepMultiplier}x multiplier)\n` +
            `    totalBidCost = ${bidCostEth.toFixed(8)} × ${sweepMultiplier} = ${totalBidCost.toFixed(8)} ETH\n` +
            `    totalGasCost = ${gasCostEth.toFixed(8)} × ${sweepMultiplier} = ${totalGasCost.toFixed(8)} ETH\n`
          : "") +
        `\n` +
        `  Step 5: Net MEV\n` +
        `    netMevEth = ${slippageAmountEth.toFixed(8)} - ${totalBidCost.toFixed(8)} - ${totalGasCost.toFixed(8)} = ${netMevEth.toFixed(8)} ETH\n` +
        `\n` +
        `  Step 6: User share & miles\n` +
        `    userMevEth = ${netMevEth.toFixed(8)} × ${USER_MEV_SHARE} (${USER_MEV_SHARE * 100}% share) = ${userMevEth.toFixed(8)} ETH\n` +
        `    miles = floor(${userMevEth.toFixed(8)} × ${MILES_PER_ETH.toLocaleString()}) = ${miles}\n` +
        `\n` +
        `  → UI displays: ${miles} miles`
    )

    return miles
    // gasReady triggers one recalc when gas data first loads; subsequent gas ticks are
    // read from refs and don't cause recalculation. Only user-driven changes (amountOut,
    // slippage) and price updates trigger recalculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    amountOut,
    slippage,
    barterPreGasOutputAmount,
    toTokenDecimals,
    enabled,
    isBarterValidating,
    gasReady,
    toTokenPrice,
    ethPrice,
    isEthOutput,
    isPermitPath,
  ])

  // Update ref outside useMemo to avoid React error #300 (state mutation during render)
  if (rawMiles != null) lastMilesRef.current = rawMiles
  const estimatedMiles = rawMiles ?? lastMilesRef.current

  // Inverse of the forward calc. Reads gas/surplus state from the same refs
  // so it stays in sync without re-rendering on background ticks.
  //
  // Effective surplus rate mirrors the forward calc's branching exactly:
  //   - Barter present  → `slippage/100` (matches the slippage-aware primary
  //     path: surplus = barterPreGas − uniswap × (1 − slippage/100), which in
  //     the typical case barter ≈ uniswap reduces to `uniswap × slippage/100`).
  //   - Barter absent   → `curSurplusRate` from Edge Config (matches the
  //     forward's fallback path). Without this branch the calculator would
  //     overestimate miles whenever barter validation is skipped (e.g. insufficient
  //     balance), disagreeing with the badge's "TBD" display on the same swap.
  const milesToAmountOut = useCallback(
    (targetMiles: number): number | null => {
      if (!Number.isFinite(targetMiles) || targetMiles <= 0) return null
      const curPriorityFee = priorityFeeRef.current
      const curBaseFee = baseFeeRef.current
      if (curPriorityFee == null) return null
      if (isPermitPath && curBaseFee == null) return null
      if (!isEthOutput && (toTokenPrice == null || toTokenPrice <= 0)) return null
      if (!isEthOutput && (!ethPrice || ethPrice <= 0)) return null

      const curAvgGasLimit = avgGasLimitRef.current
      const curAvgGasUsed = avgGasUsedRef.current
      const curSurplusRate = surplusRateRef.current

      // Prefer the forward calc's last observed effective rate so the inverse
      // exactly matches the rate the forward just produced. Falls through to
      // the slippage- or Edge-Config-derived approximation when the forward
      // hasn't run yet or the snapshot is invalid.
      const slippagePct = parseFloat(slippage)
      const barterAvailable = barterPreGasOutputAmount != null && barterPreGasOutputAmount > 0n
      const lastForwardRate = lastEffectiveSurplusRateRef.current
      const formulaicRate =
        barterAvailable && Number.isFinite(slippagePct) && slippagePct > 0
          ? slippagePct / 100
          : curSurplusRate
      const effectiveSurplusRate =
        lastForwardRate != null && Number.isFinite(lastForwardRate) && lastForwardRate > 0
          ? lastForwardRate
          : formulaicRate
      if (!Number.isFinite(effectiveSurplusRate) || effectiveSurplusRate <= 0) return null

      const bidCostEth = Number(curPriorityFee * curAvgGasLimit) / 1e18
      const gasCostEth = isPermitPath ? Number(curBaseFee * curAvgGasUsed) / 1e18 : 0
      const sweepMultiplier = isEthOutput ? 1 : 2.5
      const totalBidCost = bidCostEth * sweepMultiplier
      const totalGasCost = gasCostEth * sweepMultiplier

      const userMevEth = targetMiles / MILES_PER_ETH
      const netMevEth = userMevEth / USER_MEV_SHARE
      const slippageAmountEth = netMevEth + totalBidCost + totalGasCost
      const outputInEth = slippageAmountEth / effectiveSurplusRate
      if (!Number.isFinite(outputInEth) || outputInEth <= 0) return null

      const result = isEthOutput
        ? outputInEth
        : (outputInEth * (ethPrice as number)) / (toTokenPrice as number)
      return Number.isFinite(result) && result > 0 ? result : null
    },
    [isEthOutput, isPermitPath, toTokenPrice, ethPrice, slippage, barterPreGasOutputAmount]
  )

  // Slippage-only planner. Holds the user's swap size constant (their typed
  // `amountOut`) and solves for the slippage that produces target miles:
  //   surplus = (s/100) × outputInEth
  //   surplus = K  (where K = target/90000 + bid·sweep + gas·sweep)
  //   ⇒ s = 100·K / outputInEth
  // Capped at the current slippage as a floor (we never DECREASE slippage
  // below what auto-mode is doing) and at SLIPPAGE_MAX (50%).
  const milesToSlippage = useCallback(
    (targetMiles: number): MilesPlan | null => {
      if (!Number.isFinite(targetMiles) || targetMiles <= 0) return null

      const normalizedAmountOut = amountOut?.replace(/,/g, "") ?? ""
      const parsedAmountOut = parseFloat(normalizedAmountOut)
      if (!parsedAmountOut || parsedAmountOut <= 0) return null

      const curPriorityFee = priorityFeeRef.current
      const curBaseFee = baseFeeRef.current
      if (curPriorityFee == null) return null
      if (isPermitPath && curBaseFee == null) return null
      if (!isEthOutput && (toTokenPrice == null || toTokenPrice <= 0)) return null
      if (!isEthOutput && (!ethPrice || ethPrice <= 0)) return null

      const outputInEth = isEthOutput
        ? parsedAmountOut
        : (parsedAmountOut * (toTokenPrice as number)) / (ethPrice as number)
      if (!Number.isFinite(outputInEth) || outputInEth <= 0) return null

      const curAvgGasLimit = avgGasLimitRef.current
      const curAvgGasUsed = avgGasUsedRef.current

      const bidCostEth = Number(curPriorityFee * curAvgGasLimit) / 1e18
      const gasCostEth = isPermitPath ? Number(curBaseFee * curAvgGasUsed) / 1e18 : 0
      const sweepMultiplier = isEthOutput ? 1 : 2.5
      const totalBidCost = bidCostEth * sweepMultiplier
      const totalGasCost = gasCostEth * sweepMultiplier

      const userMevEth = targetMiles / MILES_PER_ETH
      const netMevEth = userMevEth / USER_MEV_SHARE
      // Tiny epsilon (~0.05 mile worth of surplus) so the forward's `floor()`
      // doesn't kick the miles count down by 1 due to float precision when
      // the exact slippage produces userMev × 100_000 = target − ε.
      const FLOOR_EPSILON = 5e-7
      const K = netMevEth + totalBidCost + totalGasCost + FLOOR_EPSILON

      // The forward calc (when barter is available) computes:
      //   surplus = barterPreGas − uniswap × (1 − s/100)
      // which equals `outputInEth × (lastEffectiveRate + (s − currentSlippage)/100)`
      // — invariant under slippage changes at the same swap size, since
      // barterPreGas and outputInEth don't depend on s. Solving for s when
      // surplus = K gives:
      //   s = currentSlippage + 100 × (K/outputInEth − lastEffectiveRate)
      // The naive `(100 × K)/outputInEth` formula assumes barter ≈ uniswap;
      // when barter is short, that under-quotes slippage by the shortfall
      // and the user gets fewer miles than they typed (target 10 → got 8).
      const lastEffectiveRate = lastEffectiveSurplusRateRef.current
      const currentSlippagePct = parseFloat(slippage)
      let requiredSlippagePctRaw: number
      if (
        lastEffectiveRate != null &&
        Number.isFinite(lastEffectiveRate) &&
        lastEffectiveRate >= 0 &&
        Number.isFinite(currentSlippagePct) &&
        currentSlippagePct > 0
      ) {
        requiredSlippagePctRaw = currentSlippagePct + 100 * (K / outputInEth - lastEffectiveRate)
      } else {
        requiredSlippagePctRaw = (100 * K) / outputInEth
      }

      // Edge-Config-driven cap on what slippage the calc will plan against.
      // Read from a ref so daily refreshes don't invalidate this useCallback.
      const SLIPPAGE_MAX = milesCalcMaxSlippagePctRef.current
      // Mirror useSwapSlippage's autoBase floors.
      const autoBase = isPermitPath ? 1 : 0.5
      // Round UP to 0.01% (small step). Ceiling ensures the applied slippage
      // is never below the exact requirement — combined with the floor()
      // epsilon on K above, this guarantees the forward's floor() never
      // drops the miles count below the target. Drift up: ≤1 mile.
      const SLIPPAGE_STEP = 0.01
      const requiredSlippagePct = Math.ceil(requiredSlippagePctRaw / SLIPPAGE_STEP) * SLIPPAGE_STEP
      // Tolerance above SLIPPAGE_MAX: when the target equals the displayed
      // `maxAchievableMiles` (computed at exactly the cap), the FLOOR_EPSILON
      // bump above can push the required raw slippage a few hundredths of a
      // percent past the cap depending on outputInEth. Without this tolerance,
      // typing the max would disable Apply, forcing the user to subtract a
      // mile to re-enable. Anything more than the tolerance is a real over-target.
      if (
        !Number.isFinite(requiredSlippagePct) ||
        requiredSlippagePct > SLIPPAGE_MAX + MILES_CALC_SLIPPAGE_TOLERANCE_PCT
      ) {
        return null
      }

      const finalSlippage = Math.min(SLIPPAGE_MAX, Math.max(autoBase, requiredSlippagePct))
      // Up to 2 decimal places, strip trailing zeros (e.g. 5.50 → 5.5, 5 → 5).
      const formattedSlippage = finalSlippage.toFixed(2).replace(/\.?0+$/, "")

      const requiresChange =
        !Number.isFinite(currentSlippagePct) ||
        Math.abs(finalSlippage - currentSlippagePct) >= SLIPPAGE_STEP / 2

      return {
        slippage: formattedSlippage,
        requiresChange,
      }
    },
    [amountOut, slippage, isEthOutput, isPermitPath, toTokenPrice, ethPrice]
  )

  // Upper bound: forward-compute miles at the user's CURRENT swap size
  // (`amountOut`) with SLIPPAGE_MAX (50%) as the rate ceiling. Reactive —
  // re-evaluates whenever the quote (`amountOut`), prices, gas state, path,
  // or Edge Config gas estimates tick. The hint and MAX preset stay in sync
  // with whatever the user is doing in the swap card.
  const rawMaxAchievableMiles = useMemo<number | null>(() => {
    const normalizedAmountOut = amountOut?.replace(/,/g, "") ?? ""
    const parsedAmountOut = parseFloat(normalizedAmountOut)
    if (!parsedAmountOut || parsedAmountOut <= 0) return null

    if (priorityFee == null) return null
    if (isPermitPath && baseFeePerGas == null) return null
    // Hold last value while barter is in flight — the calc max should not
    // recompute on partially-settled inputs.
    if (isBarterValidating) return null
    if (!isEthOutput && (toTokenPrice == null || toTokenPrice <= 0)) return null
    if (!isEthOutput && (!ethPrice || ethPrice <= 0)) return null

    const outputInEth = isEthOutput
      ? parsedAmountOut
      : (parsedAmountOut * (toTokenPrice as number)) / (ethPrice as number)
    if (!Number.isFinite(outputInEth) || outputInEth <= 0) return null

    const bidCostEth = Number(priorityFee * avgGasLimit) / 1e18
    const gasCostEth = isPermitPath ? Number(baseFeePerGas * avgGasUsed) / 1e18 : 0
    const sweepMultiplier = isEthOutput ? 1 : 2.5
    const totalBidCost = bidCostEth * sweepMultiplier
    const totalGasCost = gasCostEth * sweepMultiplier

    // Edge-Config-driven cap (default 50%). Mirrors what the inverse planner
    // uses so the max miles displayed in the badge are exactly what Apply at
    // the cap will produce.
    const SLIPPAGE_MAX = milesCalcMaxSlippagePct
    // Use the SAME surplus formula the forward uses, evaluated at s = SLIPPAGE_MAX.
    // Guarantees that when the calc proposes the max and the user applies
    // it, the forward at the same slippage produces matching miles in the bar.
    // Falls back to the simple (SLIPPAGE_MAX/100)·outputInEth approximation when
    // barter routing hasn't been observed yet (cold load).
    let surplusEth: number | null = null
    if (
      barterPreGasOutputAmount != null &&
      barterPreGasOutputAmount > 0n &&
      toTokenDecimals != null
    ) {
      surplusEth = computeSurplusEth({
        parsedAmountOut,
        slippagePct: SLIPPAGE_MAX,
        barterPreGasOutputAmount,
        toTokenDecimals,
        isEthOutput,
        toTokenPrice,
        ethPrice,
      })
    }
    if (surplusEth == null) {
      surplusEth = (SLIPPAGE_MAX / 100) * outputInEth
    }
    const netMev = surplusEth - totalBidCost - totalGasCost
    if (netMev <= 0) return 0
    const userMev = netMev * USER_MEV_SHARE
    return Math.floor(userMev * MILES_PER_ETH)
  }, [
    amountOut,
    isEthOutput,
    isPermitPath,
    toTokenPrice,
    ethPrice,
    priorityFee,
    baseFeePerGas,
    avgGasLimit,
    avgGasUsed,
    barterPreGasOutputAmount,
    toTokenDecimals,
    isBarterValidating,
    milesCalcMaxSlippagePct,
  ])

  // Hold the previous max while validation is in flight so the displayed
  // value doesn't drop to null and re-render briefly during transitions.
  const lastMaxRef = useRef<number | null>(null)
  if (rawMaxAchievableMiles != null) lastMaxRef.current = rawMaxAchievableMiles
  const maxAchievableMiles = rawMaxAchievableMiles ?? lastMaxRef.current

  return { estimatedMiles, milesToAmountOut, milesToSlippage, maxAchievableMiles }
}
