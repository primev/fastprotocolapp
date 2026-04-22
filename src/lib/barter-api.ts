/**
 * BarterSwap API client for route quotes
 * Calls our /api/barter/route proxy (which uses server-side BARTER_API_KEY)
 * https://app.barterswap.xyz/docs/apiv2
 */

import type { Address } from "viem"

function getApiBase(): string {
  if (typeof window !== "undefined") {
    return "" // relative URL when in browser
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

/**
 * Fetch the optimal route from Barter for swapping token A to token B.
 * Uses /api/barter/route to keep API key server-side.
 * @param source - Source token address (use WETH for native ETH)
 * @param target - Target token address
 * @param sellAmount - Amount to sell in wei (as string)
 * @param isEthInput - True when the user is spending native ETH (pays L1 gas
 *   themselves). Picks Barter's pre-gas `outputAmount` instead of
 *   `outputWithGasAmount` so the returned figure reflects what the user
 *   actually receives and isn't double-counted against the Uniswap quote in
 *   shortfall/quote-guard comparisons.
 * @returns outputAmount, gasEstimation, and optionally transactionFee and gasPrice
 */
export async function fetchBarterRoute(
  source: Address,
  target: Address,
  sellAmount: string,
  isEthInput: boolean = false
): Promise<{
  outputAmount: string
  gasEstimation: number
  transactionFee?: string
  gasPrice?: string
}> {
  const base = getApiBase()
  const resp = await fetch(`${base}/api/barter/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: source.toLowerCase(),
      target: target.toLowerCase(),
      sellAmount,
      isEthInput,
    }),
  })

  const data = await resp.json()

  if (!resp.ok) {
    const msg = data?.error ?? `Barter API error (${resp.status})`
    if (
      resp.status === 401 ||
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("api_key") ||
      msg.toLowerCase().includes("authorization")
    ) {
      throw new Error("Barter API key invalid or missing.")
    }
    if (msg.toLowerCase().includes("no route") || msg.toLowerCase().includes("route not found")) {
      throw new Error("No route found for this swap.")
    }
    if (msg.toLowerCase().includes("barter api error")) {
      throw new Error("Barter routing failed. Please try again.")
    }
    if (
      msg.toLowerCase().includes("barter") &&
      (msg.toLowerCase().includes("api") || msg.toLowerCase().includes("route"))
    ) {
      throw new Error("Barter API error. Please check your connection.")
    }
    throw new Error(msg)
  }

  const outputAmount = data?.outputAmount
  const gasEstimation = data?.gasEstimation

  if (outputAmount == null || gasEstimation == null) {
    throw new Error("Barter API error. Invalid route response.")
  }

  const result: {
    outputAmount: string
    gasEstimation: number
    transactionFee?: string
    gasPrice?: string
  } = {
    outputAmount: String(outputAmount),
    gasEstimation: Number(gasEstimation),
  }
  if (data?.transactionFee != null) result.transactionFee = String(data.transactionFee)
  if (data?.gasPrice != null) result.gasPrice = String(data.gasPrice)

  return result
}
