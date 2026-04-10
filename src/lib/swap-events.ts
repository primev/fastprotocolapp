/**
 * Cross-component signalling for "a swap was just submitted — expect a new
 * row in fastswap_miles shortly".
 *
 * Used by SwapConfirmationModal to tell the dashboard UserSwapsTable that
 * it should start polling for a specific tx hash to appear, even if the
 * table mounts *after* the swap succeeds (e.g. user swaps on the Swap tab,
 * then navigates to Dashboard).
 *
 * ### Transport
 * - **Window events** for live, same-tab notification of already-mounted
 *   listeners.
 * - **sessionStorage** as a persistent queue so that a component which
 *   mounts *after* the event was dispatched can still pick it up. Entries
 *   auto-expire after EXPIRY_MS to prevent stale polling across sessions.
 *
 * ### Why not a Zustand store?
 * The dashboard and swap flows are in different route segments and we want
 * this to survive a full client navigation. Window events + sessionStorage
 * are the simplest mechanism that works across both.
 */

const STORAGE_KEY = "fast:pending-swap-hashes"
const EVENT_NAME = "fast:swap-submitted"
/** How long a pending hash is considered interesting (2 minutes). */
const EXPIRY_MS = 2 * 60 * 1000

type PendingEntry = {
  hash: string
  /** ms since epoch when the event was dispatched. */
  submittedAt: number
}

type PendingStore = { entries: PendingEntry[] }

/**
 * Read the persistent pending queue from sessionStorage, dropping any
 * entries past EXPIRY_MS. Safe to call during SSR (returns empty).
 */
function readPending(): PendingEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PendingStore
    if (!parsed || !Array.isArray(parsed.entries)) return []
    const now = Date.now()
    return parsed.entries.filter((e) => e && typeof e.hash === "string" && now - e.submittedAt < EXPIRY_MS)
  } catch {
    return []
  }
}

/**
 * Persist the pending queue, skipping writes during SSR.
 */
function writePending(entries: PendingEntry[]): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ entries }))
  } catch {
    // Quota exceeded / disabled storage — degrade to no-op; live window
    // events still work for already-mounted listeners.
  }
}

/**
 * Notify subscribers that a swap has been submitted. Pass the final tx
 * hash (post-submit). Fires a window event for live listeners AND queues
 * the hash in sessionStorage so a listener that mounts later (e.g. after
 * navigation) can still pick it up.
 */
export function notifySwapSubmitted(hash: string): void {
  if (typeof window === "undefined") return
  if (!hash || typeof hash !== "string") return

  const entries = readPending()
  // De-dupe: if the same hash was already queued, keep the newer timestamp.
  const filtered = entries.filter((e) => e.hash.toLowerCase() !== hash.toLowerCase())
  filtered.push({ hash, submittedAt: Date.now() })
  writePending(filtered)

  window.dispatchEvent(new CustomEvent<{ hash: string }>(EVENT_NAME, { detail: { hash } }))
}

/**
 * Returns the current list of pending (submitted within the last EXPIRY_MS)
 * tx hashes. Used by a newly-mounting listener to catch up on events that
 * were dispatched before it subscribed.
 */
export function getPendingSwapHashes(): string[] {
  return readPending().map((e) => e.hash)
}

/**
 * Remove a hash from the pending queue. Callers should do this once they've
 * observed the hash in their data source (so stale entries don't live in
 * sessionStorage for the full EXPIRY_MS).
 */
export function clearPendingSwapHash(hash: string): void {
  if (!hash) return
  const entries = readPending()
  const filtered = entries.filter((e) => e.hash.toLowerCase() !== hash.toLowerCase())
  writePending(filtered)
}

/**
 * Subscribe to live swap-submitted events. Returns an unsubscribe function.
 * Note: this only fires for events dispatched *after* subscription — use
 * `getPendingSwapHashes()` on mount to replay missed events.
 */
export function subscribeSwapSubmitted(handler: (hash: string) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const listener = (ev: Event) => {
    const ce = ev as CustomEvent<{ hash: string }>
    if (ce.detail?.hash) handler(ce.detail.hash)
  }
  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
