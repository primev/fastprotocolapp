/**
 * Shared logic for ETH-path swaps: fetch tx from FastSwap and estimate gas.
 * Used by useEthPathGasEstimate (display) and use-swap-confirmation (execution).
 */

import type { Address } from "viem"
import type { PublicClient } from "viem"
import { FASTSWAP_API_BASE } from "@/lib/network-config"

export interface EthPathTxParams {
  outputToken: string
  inputAmt: string
  userAmtOut: string
  sender: string
  deadline: string
}

export interface EthPathTxResult {
  to: string
  data: string
  value: string
  gasEstimate: bigint
}

/**
 * Fetches transaction params from FastSwap /fastswap/eth and estimates gas.
 */
export async function fetchEthPathTxAndEstimate(
  params: EthPathTxParams,
  publicClient: PublicClient,
  account: Address
): Promise<EthPathTxResult | null> {
  const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap/eth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outputToken: params.outputToken,
      inputAmt: params.inputAmt,
      userAmtOut: params.userAmtOut,
      sender: params.sender,
      deadline: params.deadline,
    }),
  })

  const data = await resp.json()
  if (!resp.ok || !data?.to || !data?.data) {
    const apiError = data?.error ?? "FastSwap API error"
    throw new Error(apiError)
  }

  let estimated: bigint
  try {
    estimated = await publicClient.estimateGas({
      account,
      to: data.to as `0x${string}`,
      data: data.data as `0x${string}`,
      value: BigInt(data.value || 0),
    })
  } catch (err) {
    // Surface a clear message instead of the raw viem dump
    throw new Error(
      "This swap would fail on-chain — the price may have moved. Try increasing slippage or refreshing the quote."
    )
  }

  return {
    to: data.to,
    data: data.data,
    value: data.value ?? "0",
    gasEstimate: estimated,
  }
}
