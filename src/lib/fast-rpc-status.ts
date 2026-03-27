/**
 * Polls FastRPC's mevcommit_getTransactionCommitments JSON-RPC method.
 * This queries the FastRPC node directly — it knows about preconfirmation
 * commitments instantly, unlike the mctransactions DB which lags ~15s.
 *
 * Returns "preconfirmed" if commitments exist for this tx, null otherwise.
 */

const RPC_URL = "https://fastrpc.mev-commit.xyz"
const REQUEST_TIMEOUT_MS = 3000

export async function fetchCommitmentStatus(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<"preconfirmed" | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  if (abortSignal) {
    if (abortSignal.aborted) {
      clearTimeout(timeoutId)
      return null
    }
    abortSignal.addEventListener("abort", () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "mevcommit_getTransactionCommitments",
        params: [txHash],
        id: 1,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) return null

    const data = await response.json()

    // Log RPC errors that would otherwise be silently swallowed
    if (data?.error) {
      console.warn(`[commitmentStatus] RPC error: ${data.error.message} | hash=${txHash.slice(0, 14)}...`)
    }

    // Only trust array results with actual commitment objects
    if (data?.result && Array.isArray(data.result) && data.result.length > 0) {
      return "preconfirmed"
    }

    return null
  } catch (err) {
    clearTimeout(timeoutId)
    console.warn(`[commitmentStatus] fetch error: ${err instanceof Error ? err.message : err} | hash=${txHash.slice(0, 14)}...`)
    return null
  }
}
