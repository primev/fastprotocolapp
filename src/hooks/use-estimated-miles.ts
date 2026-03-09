"use client"

import { useState, useEffect, useMemo } from "react"
import { createPublicClient, http } from "viem"
import { mainnet } from "wagmi/chains"
import { FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(FALLBACK_RPC_ENDPOINT, {
    fetchOptions: { cache: "no-store" },
  }),
})

/** Average gas used by FastSwap transactions */
const FAST_SWAP_AVG_GAS = 450_000n
/** User receives 90% of captured MEV */
const USER_MEV_SHARE = 0.9
/** 100,000 miles per 1 ETH (0.00001 ETH per mile) */
const MILES_PER_ETH = 100_000
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

  // Poll eth_maxPriorityFeePerGas every ~12s for bid cost estimation
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const fetchPriorityFee = async () => {
      try {
        const fee = await publicClient.estimateMaxPriorityFeePerGas()
        if (!cancelled) setPriorityFee(fee)
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

  const estimatedMiles = useMemo(() => {
    if (!enabled || priorityFee == null || baseFeePerGas == null) {
      if (enabled) {
        console.debug("[useEstimatedMiles] waiting:", {
          priorityFee: priorityFee?.toString(),
          baseFeePerGas: baseFeePerGas?.toString(),
        })
      }
      return null
    }

    const parsedAmountOut = parseFloat(amountOut?.replace(/,/g, "") ?? "")
    const parsedSlippage = parseFloat(slippage ?? "0")
    if (!parsedAmountOut || parsedAmountOut <= 0 || !parsedSlippage || parsedSlippage <= 0)
      return null

    // Convert output amount to ETH
    let outputInEth: number
    if (isEthOutput) {
      outputInEth = parsedAmountOut
    } else {
      if (toTokenPrice == null || toTokenPrice <= 0 || !ethPrice || ethPrice <= 0) return null
      outputInEth = (parsedAmountOut * toTokenPrice) / ethPrice
    }

    // Slippage amount in ETH = what MEV can be captured from
    const slippageAmountEth = (parsedSlippage / 100) * outputInEth

    // Bid cost: priority fee × avg gas / 1e18
    const bidCostEth = Number(priorityFee * FAST_SWAP_AVG_GAS) / 1e18

    // Gas cost: only deducted on permit path (relayer pays)
    const gasCostEth = isPermitPath ? Number(baseFeePerGas * FAST_SWAP_AVG_GAS) / 1e18 : 0

    const netMevEth = slippageAmountEth - bidCostEth - gasCostEth

    console.debug("[useEstimatedMiles]", {
      outputInEth: outputInEth.toFixed(6),
      slippageAmountEth: slippageAmountEth.toFixed(8),
      bidCostEth: bidCostEth.toFixed(8),
      gasCostEth: gasCostEth.toFixed(8),
      netMevEth: netMevEth.toFixed(8),
      isPermitPath,
    })

    if (netMevEth <= 0) return 0

    return Math.floor(netMevEth * USER_MEV_SHARE * MILES_PER_ETH)
  }, [
    enabled,
    priorityFee,
    baseFeePerGas,
    amountOut,
    slippage,
    isEthOutput,
    toTokenPrice,
    ethPrice,
    isPermitPath,
  ])

  return { estimatedMiles }
}
