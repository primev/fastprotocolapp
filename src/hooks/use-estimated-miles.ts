"use client"

import { useState, useEffect, useRef } from "react"
import { createPublicClient, http } from "viem"
import { mainnet } from "wagmi/chains"
import { FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(FALLBACK_RPC_ENDPOINT, {
    fetchOptions: { cache: "no-store" },
  }),
})

/** Fallback average gas used by FastSwap transactions */
const DEFAULT_AVG_GAS = 450_000n
/** User receives 90% of captured MEV */
const USER_MEV_SHARE = 0.9
/** 100,000 miles per 1 ETH (0.00001 ETH per mile) */
const MILES_PER_ETH = 100_000
/** Fallback percentile for priority fee estimation */
const DEFAULT_FEE_PERCENTILE = 55
/** Module-level percentile, fetched once on page load */
let feePercentile = DEFAULT_FEE_PERCENTILE
fetch("/api/config/fee-percentile")
  .then((res) => (res.ok ? res.json() : null))
  .then((data) => {
    if (typeof data?.feePercentile === "number" && data.feePercentile > 0) {
      feePercentile = data.feePercentile
    }
  })
  .catch(() => {})
/** How often to refresh priority fee (ms) — roughly 1 block */
const PRIORITY_FEE_POLL_MS = 12_000

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
  const [avgGas, setAvgGas] = useState<bigint>(DEFAULT_AVG_GAS)

  // Fetch average gas estimate from Edge Config (updated monthly by cron)
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const fetchGasEstimate = async () => {
      try {
        const res = await fetch("/api/config/gas-estimate")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && typeof data.gasEstimate === "number" && data.gasEstimate > 0) {
          setAvgGas(BigInt(data.gasEstimate))
        }
      } catch (err) {
        console.warn("[useEstimatedMiles] Failed to fetch gas estimate:", err)
      }
    }

    fetchGasEstimate()
    return () => {
      cancelled = true
    }
  }, [enabled])

  // Poll priority fee via getFeeHistory every ~12s
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const fetchPriorityFee = async () => {
      try {
        const feeHistory = await publicClient.getFeeHistory({
          blockCount: 1,
          rewardPercentiles: [feePercentile],
        })
        const fee = feeHistory.reward?.[0]?.[0]
        if (!cancelled && fee != null) setPriorityFee(fee)
      } catch (err) {
        console.warn("[useEstimatedMiles] Failed to fetch priority fee:", err)
      }
    }

    fetchPriorityFee()
    const interval = setInterval(fetchPriorityFee, PRIORITY_FEE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [enabled])

  // Only recalculate when the Uniswap quote actually changes (amountOut).
  // Gas fees, prices, and other params are captured at calculation time but
  // do NOT trigger recalculation — we compute once per quote, not per tick.
  const [estimatedMiles, setEstimatedMiles] = useState<number | null>(null)
  const lastAmountOutRef = useRef<string>("")

  useEffect(() => {
    const normalizedAmountOut = amountOut?.replace(/,/g, "") ?? ""

    if (!enabled) {
      setEstimatedMiles(null)
      lastAmountOutRef.current = ""
      return
    }

    // Only recalculate when amountOut actually changes
    if (normalizedAmountOut === lastAmountOutRef.current) return

    if (priorityFee == null || baseFeePerGas == null) {
      console.debug("[useEstimatedMiles] waiting:", {
        priorityFee: priorityFee?.toString(),
        baseFeePerGas: baseFeePerGas?.toString(),
      })
      return
    }

    const parsedAmountOut = parseFloat(normalizedAmountOut)
    const parsedSlippage = parseFloat(slippage ?? "0")
    if (!parsedAmountOut || parsedAmountOut <= 0 || !parsedSlippage || parsedSlippage <= 0) {
      lastAmountOutRef.current = normalizedAmountOut
      setEstimatedMiles(null)
      return
    }

    // Convert output amount to ETH
    let outputInEth: number
    if (isEthOutput) {
      outputInEth = parsedAmountOut
    } else {
      if (toTokenPrice == null || toTokenPrice <= 0 || !ethPrice || ethPrice <= 0) {
        return
      }
      outputInEth = (parsedAmountOut * toTokenPrice) / ethPrice
    }

    // Slippage amount in ETH = what MEV can be captured from
    const slippageAmountEth = (parsedSlippage / 100) * outputInEth

    // Bid cost: priority fee (percentile from Edge Config) × avg gas (from Edge Config) / 1e18
    const bidCostEth = Number(priorityFee * avgGas) / 1e18

    // Gas cost: only deducted on permit path (relayer pays)
    const gasCostEth = isPermitPath ? Number(baseFeePerGas * avgGas) / 1e18 : 0

    // Sweep overhead: non-ETH output requires a sweep tx (batched fastswap).
    // 1.5x multiplier approximates pro-rata share assuming avg batch of ~3 txs.
    const sweepMultiplier = isEthOutput ? 1 : 1.5
    const totalBidCost = bidCostEth * sweepMultiplier
    const totalGasCost = gasCostEth * sweepMultiplier

    const netMevEth = slippageAmountEth - totalBidCost - totalGasCost

    const userMevEth = netMevEth > 0 ? netMevEth * USER_MEV_SHARE : 0
    const miles = netMevEth > 0 ? Math.floor(userMevEth * MILES_PER_ETH) : 0

    console.debug(
      `[useEstimatedMiles] ${miles} miles${isPermitPath ? " (permit path)" : " (ETH path)"}\n` +
        `\n` +
        `  Step 1: Convert output to ETH\n` +
        (isEthOutput
          ? `    outputInEth = ${parsedAmountOut} (native ETH output)\n`
          : `    outputInEth = ${parsedAmountOut} × $${toTokenPrice?.toFixed(2)} / $${ethPrice?.toFixed(2)} = ${outputInEth.toFixed(6)} ETH\n`) +
        `\n` +
        `  Step 2: MEV opportunity (slippage tolerance)\n` +
        `    slippageAmountEth = ${outputInEth.toFixed(6)} × ${parsedSlippage}% = ${slippageAmountEth.toFixed(8)} ETH\n` +
        `\n` +
        `  Step 3: Bid cost (priorityFee p${feePercentile} × avgGas from Edge Config)\n` +
        `    bidCostEth = ${priorityFee.toString()} wei × ${avgGas.toString()} gas / 1e18 = ${bidCostEth.toFixed(8)} ETH\n` +
        `\n` +
        `  Step 4: Gas cost${isPermitPath ? " (relayer pays on permit path)" : " (user pays on ETH path = 0)"}\n` +
        `    gasCostEth = ${isPermitPath ? `${baseFeePerGas.toString()} wei × ${avgGas.toString()} gas / 1e18 = ` : ""}${gasCostEth.toFixed(8)} ETH\n` +
        (!isEthOutput ? `\n  Step 4b: Sweep overhead (non-ETH output, ${sweepMultiplier}x multiplier)\n` +
        `    totalBidCost = ${bidCostEth.toFixed(8)} × ${sweepMultiplier} = ${totalBidCost.toFixed(8)} ETH\n` +
        `    totalGasCost = ${gasCostEth.toFixed(8)} × ${sweepMultiplier} = ${totalGasCost.toFixed(8)} ETH\n` : "") +
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
    lastAmountOutRef.current = normalizedAmountOut
    setEstimatedMiles(miles)
    // amountOut is the primary trigger. priorityFee/baseFeePerGas/toTokenPrice/ethPrice are
    // included so the effect retries once async data arrives, but the ref guard ensures
    // we only compute once per unique amountOut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountOut, enabled, priorityFee, baseFeePerGas, toTokenPrice, ethPrice])

  return { estimatedMiles }
}
