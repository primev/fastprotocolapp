"use client"

import { useCallback } from "react"
import { useBlock } from "wagmi"
import { formatUnits } from "viem"

/** Gas-limit safety headroom (not a cost multiplier — user pays actual gasUsed). */
export const GAS_LIMIT_MULTIPLIER = 100n
export const ETH_PATH_GAS_LIMIT_MULTIPLIER = 140n

/**
 * Priority fee (tip) applied to every broadcast. We want this effectively zero.
 * 1 wei is the smallest non-zero value most infrastructure will accept — keeps
 * cost unchanged to ~18 decimal places but avoids any "tip == 0" edge cases.
 */
const PRIORITY_FEE_WEI = 1n

/**
 * Headroom on maxFeePerGas so the tx stays includable if baseFee climbs between
 * quote and inclusion. This is a CEILING only — the user pays
 * `min(maxFeePerGas, baseFee + maxPriorityFeePerGas) × gasUsed`, so 2× doesn't
 * cost 2×. EIP-1559 baseFee changes at most 12.5% per block, so 2× ≈ 6 blocks
 * of headroom.
 */
const MAX_FEE_CEILING_MULTIPLIER = 2n

export type GasFees = { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | undefined

function gasFeesFromBaseFee(baseFeePerGas: bigint): GasFees {
  return {
    maxFeePerGas: baseFeePerGas * MAX_FEE_CEILING_MULTIPLIER + PRIORITY_FEE_WEI,
    maxPriorityFeePerGas: PRIORITY_FEE_WEI,
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

  // Effective price the user actually pays per gas unit: baseFee + tip.
  // Used for the UI cost estimate so display = cost paid.
  const effectivePrice = baseFeePerGas != null ? baseFeePerGas + PRIORITY_FEE_WEI : null
  const gasPriceGwei = effectivePrice != null ? parseFloat(formatUnits(effectivePrice, 9)) : null

  return {
    gasFees,
    getFreshGasFees,
    rawMaxFeePerGas: effectivePrice,
    rawLegacyPrice: effectivePrice,
    rawPrice: effectivePrice,
    bufferedPrice: effectivePrice,
    gasPriceGwei,
  }
}
