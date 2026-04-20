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
 * `min(maxFeePerGas, baseFee + maxPriorityFeePerGas) × gasUsed`, so bumping the
 * ceiling doesn't raise cost. Expressed as a percentage of baseFee.
 *
 * 125% = ~2 blocks of headroom (baseFee can rise at most 12.5% per block under
 * EIP-1559). On mainnet ~95% of txs land within 2 blocks, so this keeps the
 * wallet's displayed "max fee" close to the actual cost without meaningful
 * drop risk.
 */
const MAX_FEE_CEILING_BPS = 125n

export type GasFees = { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | undefined

function gasFeesFromBaseFee(baseFeePerGas: bigint): GasFees {
  return {
    maxFeePerGas: (baseFeePerGas * MAX_FEE_CEILING_BPS) / 100n + PRIORITY_FEE_WEI,
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
