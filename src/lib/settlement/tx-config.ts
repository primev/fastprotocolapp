const DEFAULT_TIMEOUT_MS = 60000

let cachedTimeoutMs: number | null = null

/** Pre-warm the timeout cache on app load so first poll has zero delay. */
const warmupPromise =
  typeof window !== "undefined"
    ? fetch("/api/config/tx-timeout")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.timeoutMs === "number" && data.timeoutMs > 0) {
            cachedTimeoutMs = data.timeoutMs
          }
        })
        .catch(() => {})
    : Promise.resolve()

export async function getTxConfirmationTimeoutMs(): Promise<number> {
  if (cachedTimeoutMs !== null) return cachedTimeoutMs

  // Wait for warmup if it's still in-flight (usually already resolved by now)
  await warmupPromise

  if (cachedTimeoutMs !== null) return cachedTimeoutMs

  try {
    const res = await fetch("/api/config/tx-timeout")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const resolved: number =
      typeof data.timeoutMs === "number" && data.timeoutMs > 0 ? data.timeoutMs : DEFAULT_TIMEOUT_MS
    cachedTimeoutMs = resolved
    return resolved
  } catch {
    return DEFAULT_TIMEOUT_MS
  }
}
