"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { RPC_ENDPOINT } from "@/lib/network-config"

/** Fallback average gas limit for bid cost calculation (priorityFee × gasLimit) */
const DEFAULT_AVG_GAS_LIMIT = 450_000n
/** Fallback average gas used for gas cost calculation on permit path (baseFee × gasUsed) */
const DEFAULT_AVG_GAS_USED = 180_000n
/** User receives 90% of captured MEV */
const USER_MEV_SHARE = 0.9
/** 100,000 miles per 1 ETH (0.00001 ETH per mile) */
const MILES_PER_ETH = 100_000
/** How often to refresh bid estimate from FastRPC (ms) — roughly 1 block */
const BID_ESTIMATE_POLL_MS = 12_000

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
}: UseEstimatedMilesParams): UseEstimatedMilesReturn {
  const [priorityFee, setPriorityFee] = useState<bigint | null>(null)
  const [avgGasLimit, setAvgGasLimit] = useState<bigint>(DEFAULT_AVG_GAS_LIMIT)
  const [avgGasUsed, setAvgGasUsed] = useState<bigint>(DEFAULT_AVG_GAS_USED)
  const [surplusRate, setSurplusRate] = useState(DEFAULT_SURPLUS_RATE)

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
  priorityFeeRef.current = priorityFee
  baseFeeRef.current = baseFeePerGas
  avgGasLimitRef.current = avgGasLimit
  avgGasUsedRef.current = avgGasUsed
  surplusRateRef.current = surplusRate

  // Track last successful miles so transient states don't flash null.
  const lastMilesRef = useRef<number | null>(null)

  // Whether gas data has loaded at least once — triggers one recalc when it arrives.
  const gasReady = priorityFee != null && baseFeePerGas != null

  // Synchronous calculation — updates in the same render as slippage/amountOut changes.
  // gasReady is a dep so we recalculate once when gas data first arrives, but subsequent
  // gas fee ticks (every 12s) are read from refs and don't trigger recalculation.
  const rawMiles = useMemo(() => {
    if (!enabled) return null

    const normalizedAmountOut = amountOut?.replace(/,/g, "") ?? ""
    const curPriorityFee = priorityFeeRef.current
    const curBaseFee = baseFeeRef.current
    const curAvgGasLimit = avgGasLimitRef.current
    const curAvgGasUsed = avgGasUsedRef.current
    if (curPriorityFee == null || curBaseFee == null) return null

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
    gasReady,
    toTokenPrice,
    ethPrice,
    isEthOutput,
    isPermitPath,
  ])

  // Update ref outside useMemo to avoid React error #300 (state mutation during render)
  if (rawMiles != null) lastMilesRef.current = rawMiles
  const estimatedMiles = rawMiles ?? lastMilesRef.current

  // Inverse of the forward calc above. Reads from the same refs so it stays
  // in sync with the latest gas/surplus data without re-rendering on ticks.
  const milesToAmountOut = useCallback(
    (targetMiles: number): number | null => {
      if (!Number.isFinite(targetMiles) || targetMiles <= 0) return null
      const curPriorityFee = priorityFeeRef.current
      const curBaseFee = baseFeeRef.current
      if (curPriorityFee == null || curBaseFee == null) return null
      if (!isEthOutput && (toTokenPrice == null || toTokenPrice <= 0)) return null
      if (!isEthOutput && (!ethPrice || ethPrice <= 0)) return null

      const curAvgGasLimit = avgGasLimitRef.current
      const curAvgGasUsed = avgGasUsedRef.current
      const curSurplusRate = surplusRateRef.current

      const bidCostEth = Number(curPriorityFee * curAvgGasLimit) / 1e18
      const gasCostEth = isPermitPath ? Number(curBaseFee * curAvgGasUsed) / 1e18 : 0
      const sweepMultiplier = isEthOutput ? 1 : 2.5
      const totalBidCost = bidCostEth * sweepMultiplier
      const totalGasCost = gasCostEth * sweepMultiplier

      const userMevEth = targetMiles / MILES_PER_ETH
      const netMevEth = userMevEth / USER_MEV_SHARE
      const slippageAmountEth = netMevEth + totalBidCost + totalGasCost
      const outputInEth = slippageAmountEth / curSurplusRate
      if (!Number.isFinite(outputInEth) || outputInEth <= 0) return null

      const result = isEthOutput
        ? outputInEth
        : (outputInEth * (ethPrice as number)) / (toTokenPrice as number)
      return Number.isFinite(result) && result > 0 ? result : null
    },
    [isEthOutput, isPermitPath, toTokenPrice, ethPrice]
  )

  return { estimatedMiles, milesToAmountOut }
}
