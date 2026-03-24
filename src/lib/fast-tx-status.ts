export type FastTxStatus = "pre-confirmed" | "confirmed" | "failed" | null

const REQUEST_TIMEOUT_MS = 5000

/**
 * Fetches the mctransactions status for a swap tx hash.
 * Returns "pre-confirmed" | "confirmed" | "failed" | null (not found yet).
 */
export async function fetchFastTxStatus(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<FastTxStatus> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`/api/fast-tx-status/${txHash}`, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (abortSignal?.aborted) return null

    if (!response.ok) return null

    const data = await response.json()
    return data.status as FastTxStatus
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}
