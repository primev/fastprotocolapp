export type FastTxStatus = "preconfirmed" | "confirmed" | "failed" | null

export type FastTxStatusResult = {
  status: FastTxStatus
  /** Raw `mctransactions.details` for the row (e.g. simulation revert reason). */
  details: string | null
}

const REQUEST_TIMEOUT_MS = 5000

/** Normalize DB status values (e.g. "pre-confirmed") to frontend values ("preconfirmed"). */
function normalizeStatus(raw: string | null | undefined): FastTxStatus {
  if (raw === "pre-confirmed" || raw === "preconfirmed") return "preconfirmed"
  if (raw === "confirmed") return "confirmed"
  if (raw === "failed") return "failed"
  return null
}

/**
 * Fetches the mctransactions status (and raw details) for a swap tx hash.
 * `details` is forwarded to Vercel error logs so we can categorize the
 * underlying simulation-failure reason instead of logging a generic message.
 */
export async function fetchFastTxStatus(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<FastTxStatusResult> {
  const empty: FastTxStatusResult = { status: null, details: null }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  if (abortSignal) {
    if (abortSignal.aborted) {
      clearTimeout(timeoutId)
      return empty
    }
    abortSignal.addEventListener("abort", () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(`/api/fast-tx-status/${txHash}`, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (abortSignal?.aborted) return empty
    if (!response.ok) return empty

    const data = (await response.json()) as {
      status?: string | null
      details?: string | null
    }

    return {
      status: normalizeStatus(data.status),
      details: typeof data.details === "string" && data.details.length > 0 ? data.details : null,
    }
  } catch {
    clearTimeout(timeoutId)
    return empty
  }
}
