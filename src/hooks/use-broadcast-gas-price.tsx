"use client"

import { useCallback } from "react"
import { useBlock } from "wagmi"
import { formatUnits } from "viem"

export const GAS_LIMIT_MULTIPLIER = 100n
export const ETH_PATH_GAS_LIMIT_MULTIPLIER = 140n // 40% buffer for tx
/**
 * Wallets pad the displayed "estimated cost" by ~20% above the raw simulated
 * `gasUsed` as a safety margin (independent of our submitted gasLimit). We
 * apply the same padding to our display so the cost line matches the wallet
 * popup. Tx submission still uses ETH_PATH_GAS_LIMIT_MULTIPLIER (40%).
 */
export const ETH_PATH_DISPLAY_GAS_PADDING = 120n

/**
 * Priority fee on ETH-input swaps. Zero — FastSwap inclusion is bought by the
 * bidder via mev-commit preconfirmation, so the user's L1 tx doesn't need to
 * tip a builder for inclusion. We populate `maxPriorityFeePerGas: 0n` on the
 * tx in `use-swap-confirmation` so the wallet displays a 0 tip too, keeping
 * our cost line and the wallet popup aligned.
 */
const ETH_PATH_PRIORITY_FEE_WEI = 0n

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

  // ETH-path display: match the wallet's "estimated cost" panel, which uses
  // the EFFECTIVE per-gas price (baseFee + priorityFee) — i.e. what the user
  // typically pays. `maxFeePerGas` (baseFee × 2 + tip) only sets the ceiling
  // for unusual base-fee spikes; the wallet doesn't put that in the cost
  // line, so neither do we.
  const ethPathDisplayFeePerGas =
    baseFeePerGas != null ? baseFeePerGas + ETH_PATH_PRIORITY_FEE_WEI : null

  return {
    gasFees,
    getFreshGasFees,
    rawMaxFeePerGas: effectivePrice,
    rawLegacyPrice: effectivePrice,
    rawPrice,
    ethPathDisplayFeePerGas,
    gasPriceGwei,
  }
}
