"use client"

import { useCallback } from "react"
import { useEstimateFeesPerGas, useGasPrice as useWagmiGasPrice } from "wagmi"
import { formatUnits } from "viem"

// PRODUCTION BUFFERS
export const GAS_PRICE_MULTIPLIER = 115n
export const GAS_LIMIT_MULTIPLIER = 120n

export type GasFees =
  | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  | { gasPrice: bigint }
  | undefined

function deriveGasFees(
  feeData: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } | undefined,
  legacyGasPrice: bigint | undefined
): GasFees {
  if (feeData?.maxFeePerGas != null && feeData?.maxPriorityFeePerGas != null) {
    return {
      maxFeePerGas: (feeData.maxFeePerGas * GAS_PRICE_MULTIPLIER) / 100n,
      maxPriorityFeePerGas: 0n,
    }
  }
  if (legacyGasPrice != null) {
    return { gasPrice: (legacyGasPrice * GAS_PRICE_MULTIPLIER) / 100n }
  }
  return undefined
}

export function useBroadcastGasPrice() {
  const { data: feeData, refetch: refetchFees } = useEstimateFeesPerGas({
    query: { refetchInterval: 12_000 },
  })

  const { data: legacyGasPrice, refetch: refetchLegacy } = useWagmiGasPrice({
    query: { refetchInterval: 12_000 },
  })

  const gasFees = deriveGasFees(feeData, legacyGasPrice ?? undefined)

  const getFreshGasFees = useCallback(async (): Promise<GasFees> => {
    const [feeResult, legacyResult] = await Promise.all([refetchFees(), refetchLegacy()])
    const fd = feeResult.data ?? feeData
    const lp = legacyResult.data ?? legacyGasPrice
    return deriveGasFees(fd, lp ?? undefined)
  }, [refetchFees, refetchLegacy, feeData, legacyGasPrice])

  const rawPrice = feeData?.maxFeePerGas ?? legacyGasPrice ?? null
  const gasPriceGwei = rawPrice != null ? parseFloat(formatUnits(rawPrice, 9)) : null
  const bufferedPrice =
    gasFees != null ? ("maxFeePerGas" in gasFees ? gasFees.maxFeePerGas : gasFees.gasPrice) : null

  return {
    gasFees,
    getFreshGasFees,
    rawMaxFeePerGas: feeData?.maxFeePerGas ?? null,
    rawLegacyPrice: legacyGasPrice ?? null,
    rawPrice,
    bufferedPrice,
    gasPriceGwei,
  }
}
