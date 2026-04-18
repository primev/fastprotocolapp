"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { RPC_ENDPOINT } from "@/lib/config/network"

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
  toTokenPrice: number | null
  ethPrice: number | null
  isEthOutput: boolean
  baseFeePerGas: bigint | null
  isPermitPath: boolean
  enabled: boolean
}

export function useEstimatedMiles({
  amountOut,
  slippage,
  toTokenPrice,
  ethPrice,
  isEthOutput,
  baseFeePerGas,
  isPermitPath,
  enabled,
}: UseEstimatedMilesParams): { estimatedMiles: number | null } {
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

    // MEV pot in ETH = median surplus rate (from Edge Config) × outputInEth.
    const curSurplusRate = surplusRateRef.current
    const slippageAmountEth = curSurplusRate * outputInEth

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
      `[useEstimatedMiles] ${miles} miles | ${isPermitPath ? "permit" : "ETH"} path\n` +
        `\n` +
        `  Step 1: Convert output to ETH\n` +
        (isEthOutput
          ? `    outputInEth = ${parsedAmountOut} (native ETH output)\n`
          : `    outputInEth = ${parsedAmountOut} × $${toTokenPrice?.toFixed(2)} / $${ethPrice?.toFixed(2)} = ${outputInEth.toFixed(6)} ETH\n`) +
        `\n` +
        `  Step 2: MEV pot (median surplus rate = ${(curSurplusRate * 100).toFixed(2)}% of output)\n` +
        `    slippageAmountEth = ${outputInEth.toFixed(6)} × ${curSurplusRate} = ${slippageAmountEth.toFixed(8)} ETH\n` +
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
  }, [amountOut, slippage, enabled, gasReady, toTokenPrice, ethPrice, isEthOutput, isPermitPath])

  // Update ref outside useMemo to avoid React error #300 (state mutation during render)
  if (rawMiles != null) lastMilesRef.current = rawMiles
  const estimatedMiles = rawMiles ?? lastMilesRef.current

  return { estimatedMiles }
}
