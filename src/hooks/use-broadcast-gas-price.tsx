"use client"

import { useCallback } from "react"
import { useBlock } from "wagmi"
import { formatUnits } from "viem"

export const GAS_LIMIT_MULTIPLIER = 100n
export const ETH_PATH_GAS_LIMIT_MULTIPLIER = 140n // 40% buffer

const PRIORITY_FEE_WEI = 0n

export type GasFees =
  | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  | { gasPrice: bigint }
  | undefined

function gasFeesFromBaseFee(baseFeePerGas: bigint): GasFees {
  return {
    maxFeePerGas: baseFeePerGas,
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
