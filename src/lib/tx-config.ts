const DEFAULT_TIMEOUT_MS = 60000

let cachedTimeoutMs: number | null = null

export async function getTxConfirmationTimeoutMs(): Promise<number> {
  if (cachedTimeoutMs !== null) return cachedTimeoutMs

  try {
    const res = await fetch("/api/config/tx-timeout")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    cachedTimeoutMs =
      typeof data.timeoutMs === "number" && data.timeoutMs > 0 ? data.timeoutMs : DEFAULT_TIMEOUT_MS
    return cachedTimeoutMs
  } catch {
    return DEFAULT_TIMEOUT_MS
  }
}
