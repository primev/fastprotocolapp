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
    return parsed.entries.filter(
      (e) => e && typeof e.hash === "string" && now - e.submittedAt < EXPIRY_MS
    )
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
 * hash (post-submit) and optionally the pre-swap estimated miles so the
 * dashboard table can show an estimate while the row is pending.
 *
 * Fires a window event for live listeners AND queues the hash in
 * sessionStorage so a listener that mounts later (e.g. after navigation)
 * can still pick it up.
 */
export function notifySwapSubmitted(hash: string, estimatedMiles?: number | null): void {
  if (typeof window === "undefined") return
  if (!hash || typeof hash !== "string") return

  const entries = readPending()
  // De-dupe: if the same hash was already queued, keep the newer timestamp.
  const filtered = entries.filter((e) => e.hash.toLowerCase() !== hash.toLowerCase())
  filtered.push({ hash, submittedAt: Date.now() })
  writePending(filtered)

  // Stash the estimated miles separately (longer TTL) so the dashboard
  // table can display them while the row is pending settlement.
  if (estimatedMiles != null && estimatedMiles > 0) {
    stashEstimatedMiles(hash, estimatedMiles)
  }

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

// ---------------------------------------------------------------------------
// Estimated miles stash — separate from the pending hash queue so it
// survives longer (miles can take minutes to settle, well past the 2-min
// pending hash expiry).
// ---------------------------------------------------------------------------

const MILES_STASH_KEY = "fast:estimated-miles"
/** Keep stashed estimates for 30 minutes — plenty of time for settlement. */
const MILES_STASH_EXPIRY_MS = 30 * 60 * 1000

type MilesStashEntry = {
  hash: string
  miles: number
  at: number
}

function readMilesStash(): MilesStashEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(MILES_STASH_KEY)
    if (!raw) return []
    const entries = JSON.parse(raw) as MilesStashEntry[]
    if (!Array.isArray(entries)) return []
    const now = Date.now()
    return entries.filter((e) => e && now - e.at < MILES_STASH_EXPIRY_MS)
  } catch {
    return []
  }
}

function writeMilesStash(entries: MilesStashEntry[]): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(MILES_STASH_KEY, JSON.stringify(entries))
  } catch {}
}

/**
 * Stash the pre-swap estimated miles for a tx hash so the dashboard
 * table can display it while the row is pending.
 */
export function stashEstimatedMiles(hash: string, miles: number): void {
  if (!hash || miles <= 0) return
  const entries = readMilesStash().filter((e) => e.hash.toLowerCase() !== hash.toLowerCase())
  entries.push({ hash, miles, at: Date.now() })
  writeMilesStash(entries)
}

/**
 * Look up the pre-swap estimated miles for a given tx hash.
 */
export function getEstimatedMilesForHash(hash: string): number | null {
  if (!hash) return null
  const entry = readMilesStash().find((e) => e.hash.toLowerCase() === hash.toLowerCase())
  return entry?.miles ?? null
}

/**
 * Remove a stashed estimate once real miles are finalized.
 */
export function clearEstimatedMiles(hash: string): void {
  if (!hash) return
  const entries = readMilesStash().filter((e) => e.hash.toLowerCase() !== hash.toLowerCase())
  writeMilesStash(entries)
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
