"use client"

import { useCallback } from "react"
import { useBlock } from "wagmi"
import { formatUnits } from "viem"

// Gas limit buffer (120 = 20% over estimate to avoid out-of-gas)
export const GAS_LIMIT_MULTIPLIER = 100n
export const ETH_PATH_GAS_LIMIT_MULTIPLIER = 140n // 40% buffer

// Matches wallet "Normal" tier: 2 gwei tip per Blocknative
// https://www.blocknative.com/blog/eip-1559-fees
// const PRIORITY_FEE_WEI = 1_000_000_000n
const PRIORITY_FEE_WEI = 0n

export type GasFees =
  | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  | { gasPrice: bigint }
  | undefined

/**
 * Match wallet "Normal" tier: maxFee = base + priority (no 2x buffer).
 * Wallet displays this as its estimate; 2x buffer caused Custom to show higher than our UI.
 */
function gasFeesFromBaseFee(baseFeePerGas: bigint): GasFees {
  // To match "Normal" with 0 priority:
  // We set maxFee to exactly the baseFee.
  // If the wallet adds 2 Gwei to its "Normal" view, we simply provide the raw baseFee.

  return {
    maxFeePerGas: baseFeePerGas, // Remove any multipliers here
    maxPriorityFeePerGas: 0n,
  }
}

export function useBroadcastGasPrice() {
  const { data: block, refetch: refetchBlock } = useBlock({
    query: { refetchInterval: 12_000 },
  })

  const baseFeePerGas = block?.baseFeePerGas ?? null
  const gasFees = baseFeePerGas != null ? gasFeesFromBaseFee(baseFeePerGas) : undefined

  const getFreshGasFees = useCallback(async (): Promise<GasFees> => {
    const { data: freshBlock } = await refetchBlock()
    const baseFee = freshBlock?.baseFeePerGas
    if (baseFee != null) {
      return gasFeesFromBaseFee(baseFee)
    }
    return undefined
  }, [refetchBlock])

  // Expected cost at execution = base + priority (user pays this, not the max)
  const effectivePrice = baseFeePerGas != null ? baseFeePerGas + PRIORITY_FEE_WEI : null
  const rawPrice = effectivePrice
  const gasPriceGwei = effectivePrice != null ? parseFloat(formatUnits(effectivePrice, 9)) : null
  const bufferedPrice = effectivePrice

  return {
    gasFees,
    getFreshGasFees,
    rawMaxFeePerGas: effectivePrice,
    rawLegacyPrice: effectivePrice,
    rawPrice,
    bufferedPrice,
    gasPriceGwei,
  }
}
