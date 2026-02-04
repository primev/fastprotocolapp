/**
 * Shared logic for ETH-path swaps: fetch tx from FastSwap and estimate gas.
 * Used by useEthPathGasEstimate (display) and use-swap-confirmation (execution).
 * Uses the connected wallet client for estimates so they match what the wallet displays.
 */

import type { Address } from "viem"
import type { PublicClient, WalletClient } from "viem"
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

/** Client that can estimate gas (wallet preferred, public as fallback) */
type GasEstimateClient = WalletClient | PublicClient

/**
 * Fetches transaction params from FastSwap /fastswap/eth and estimates gas.
 * Prefer walletClient so estimates match wallet display; fall back to publicClient
 * when wallet client is unavailable (some providers don't expose it).
 */
export async function fetchEthPathTxAndEstimate(
  params: EthPathTxParams,
  client: GasEstimateClient,
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

  const estimated = await client.estimateGas({
    account,
    to: data.to as `0x${string}`,
    data: data.data as `0x${string}`,
    value: BigInt(data.value || 0),
  })

  return {
    to: data.to,
    data: data.data,
    value: data.value ?? "0",
    gasEstimate: estimated,
  }
}
