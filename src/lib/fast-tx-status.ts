export type FastTxStatus = "preconfirmed" | "confirmed" | "failed" | null

const REQUEST_TIMEOUT_MS = 5000

/** Normalize DB status values (e.g. "pre-confirmed") to frontend values ("preconfirmed"). */
function normalizeStatus(raw: string): FastTxStatus {
  if (raw === "pre-confirmed" || raw === "preconfirmed") return "preconfirmed"
  if (raw === "confirmed") return "confirmed"
  if (raw === "failed") return "failed"
  return null
}

/**
 * Fetches the mctransactions status for a swap tx hash.
 * Returns "preconfirmed" | "confirmed" | "failed" | null (not found yet).
 */
export async function fetchFastTxStatus(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<FastTxStatus> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // Link parent abort signal so in-flight requests cancel immediately
  if (abortSignal) {
    if (abortSignal.aborted) {
      clearTimeout(timeoutId)
      return null
    }
    abortSignal.addEventListener("abort", () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(`/api/fast-tx-status/${txHash}`, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (abortSignal?.aborted) return null

    if (!response.ok) return null

    const data = await response.json()
    return data.status ? normalizeStatus(data.status) : null
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}
