"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  clearPendingSwapHash,
  getPendingSwapHashes,
  subscribeSwapSubmitted,
} from "@/lib/swap-events"
import { refetchMiles } from "@/hooks/use-user-points"

/**
 * Shape of a single swap row as returned by `/api/fastswap-miles/by-address`.
 * Kept intentionally flat for easy rendering in a table.
 */
export type UserSwapRow = {
  txHash: string
  blockTimestamp: string | null
  swapType: string | null
  tokenIn: {
    address: string
    symbol: string
    logoURI: string | null
    decimals: number
    unknown: boolean
  }
  tokenOut: {
    address: string
    symbol: string
    logoURI: string | null
    decimals: number
    unknown: boolean
  }
  amountIn: string | null
  amountOut: string | null
  surplusEth: number | null
  miles: number | null
  processed: boolean
}

export type UserSwapsPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type UseUserSwapsReturn = {
  swaps: UserSwapRow[]
  pagination: UserSwapsPagination
  totalMiles: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

type UseUserSwapsOptions = {
  /** 1-indexed page number. Changing this triggers a new fetch. */
  page: number
  /** Rows per page (default 25). */
  pageSize?: number
  /**
   * Base polling interval in ms while there are any pending (processed=false)
   * rows visible on the current page. Default 15s. Polling auto-pauses when
   * the tab is hidden.
   */
  pollIntervalMs?: number
}

const EMPTY_PAGINATION: UserSwapsPagination = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
}

/**
 * How often to poll while we are *awaiting* a specific tx hash to appear
 * in the table (i.e. the user just swapped and the DB row hasn't shown up
 * yet). Faster than the "row is pending" poll because we want the UI to
 * react as soon as the writer lands the row.
 */
const AWAITING_POLL_MS = 5_000

/**
 * Bound how long we'll keep polling for an expected tx hash before giving
 * up. Matches the sessionStorage TTL in swap-events.ts.
 */
const AWAITING_TIMEOUT_MS = 2 * 60 * 1000

/**
 * Fetches a paginated slice of the user's FastSwap miles rows and polls
 * for updates to any pending (processed=false) rows on the current page.
 *
 * ### Polling strategy
 * - Initial fetch fires immediately on mount and whenever `address` or `page`
 *   changes.
 * - After each fetch, if any row on the current page has `processed=false`,
 *   the hook schedules another fetch in `pollIntervalMs` ms. Once every row
 *   is processed, polling stops — the view is static until the user swaps
 *   again or switches pages.
 * - Polling pauses when `document.visibilityState === "hidden"` and resumes
 *   with an immediate fetch on refocus.
 * - A manual `refetch()` is exposed for external triggers (e.g. after a
 *   successful swap from SwapConfirmationModal).
 */
export function useUserSwaps(
  address: string | undefined,
  { page, pageSize = 25, pollIntervalMs = 15_000 }: UseUserSwapsOptions
): UseUserSwapsReturn {
  const [swaps, setSwaps] = useState<UserSwapRow[]>([])
  const [pagination, setPagination] = useState<UserSwapsPagination>(EMPTY_PAGINATION)
  const [totalMiles, setTotalMiles] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the in-flight fetch so we can cancel if the component unmounts,
  // the address changes, or the page changes mid-request.
  const abortRef = useRef<AbortController | null>(null)
  // Poll timer ID so we can clear it from multiple code paths.
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest "has pending" flag captured outside of React state so the
  // visibilitychange handler can read it without re-subscribing.
  const hasPendingRef = useRef(false)
  // Set of tx hashes (lowercase) we are currently waiting to observe in
  // the fetched rows. Populated from window events + sessionStorage and
  // cleared as each hash is seen (or on timeout).
  const awaitingHashesRef = useRef<Set<string>>(new Set())
  // Per-hash timeout IDs so we can cancel individual awaits if the hash
  // appears before the timer fires.
  const awaitingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Snapshot of tx hashes (lowercase) that were `processed=false` on the
  // previous fetch. Used to detect the exact moment a row transitions
  // from pending to finalized so we can trigger a downstream Fuul refetch.
  const prevPendingHashesRef = useRef<Set<string>>(new Set())

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const fetchSwaps = useCallback(
    async (addr: string, p: number, signal: AbortSignal, { silent = false } = {}) => {
      if (!silent) setIsLoading(true)
      setError(null)
      try {
        const url = `/api/fastswap-miles/by-address?address=${encodeURIComponent(
          addr
        )}&page=${p}&pageSize=${pageSize}`
        const res = await fetch(url, { signal })
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`)
        }
        const json = (await res.json()) as {
          success?: boolean
          swaps?: UserSwapRow[]
          pagination?: UserSwapsPagination
          totalMiles?: number
        }
        if (!json.success || !Array.isArray(json.swaps)) {
          throw new Error("Malformed response")
        }
        if (signal.aborted) return
        setSwaps(json.swaps)
        setPagination(json.pagination ?? EMPTY_PAGINATION)
        setTotalMiles(typeof json.totalMiles === "number" ? json.totalMiles : 0)

        // Detect pending → finalized transitions. Any tx hash that was
        // `processed=false` on the previous fetch and is `processed=true`
        // on this fetch represents a freshly-credited miles record;
        // poke useUserPoints so the AppHeader (and anyone else listening
        // to the refetch-miles event) pulls fresh Fuul data.
        const prevPending = prevPendingHashesRef.current
        let finalizedAny = false
        if (prevPending.size > 0) {
          for (const s of json.swaps) {
            if (s.processed && prevPending.has(s.txHash.toLowerCase())) {
              finalizedAny = true
              break
            }
          }
        }
        if (finalizedAny) {
          refetchMiles()
        }

        // Rebuild the pending snapshot for the next diff.
        const nextPending = new Set<string>()
        for (const s of json.swaps) {
          if (!s.processed) nextPending.add(s.txHash.toLowerCase())
        }
        prevPendingHashesRef.current = nextPending

        hasPendingRef.current = nextPending.size > 0

        // If any awaited tx hash has just appeared in the rows, stop
        // tracking it: cancel its timeout and remove from the pending
        // queue. Subsequent polls can rely on the normal "has pending"
        // signal to keep refreshing until the row is processed.
        if (awaitingHashesRef.current.size > 0 && json.swaps.length > 0) {
          const seen = new Set(json.swaps.map((s) => s.txHash.toLowerCase()))
          for (const hash of Array.from(awaitingHashesRef.current)) {
            if (seen.has(hash)) {
              awaitingHashesRef.current.delete(hash)
              const timer = awaitingTimeoutsRef.current.get(hash)
              if (timer) {
                clearTimeout(timer)
                awaitingTimeoutsRef.current.delete(hash)
              }
              clearPendingSwapHash(hash)
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        console.warn("[useUserSwaps] Failed to fetch swaps:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        if (!signal.aborted) setIsLoading(false)
      }
    },
    [pageSize]
  )

  /**
   * Schedules the next poll if polling is warranted, and the tab is visible.
   *
   * Polling runs when either:
   *   - any row on the current page is `processed=false` (normal pending
   *     miles calculation), or
   *   - we are awaiting a specific tx hash that hasn't appeared in the
   *     fetched rows yet (post-swap "waiting for row to land" state).
   *
   * Awaiting mode uses a faster 5s cadence; pending mode uses the regular
   * 15s cadence. When both conditions apply, the faster cadence wins.
   */
  const schedulePoll = useCallback(
    (addr: string, p: number) => {
      clearPollTimer()
      const isAwaiting = awaitingHashesRef.current.size > 0
      const isPending = hasPendingRef.current
      if (!isAwaiting && !isPending) return
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return

      const delay = isAwaiting ? AWAITING_POLL_MS : pollIntervalMs
      pollTimerRef.current = setTimeout(() => {
        const controller = new AbortController()
        abortRef.current = controller
        fetchSwaps(addr, p, controller.signal, { silent: true }).then(() => schedulePoll(addr, p))
      }, delay)
    },
    [clearPollTimer, fetchSwaps, pollIntervalMs]
  )

  /**
   * Begin tracking a specific tx hash. Adds it to the awaiting set, sets
   * a timeout to give up after AWAITING_TIMEOUT_MS, and kicks off an
   * immediate refetch so the user sees a reaction within one render.
   */
  const startAwaitingHash = useCallback(
    (addr: string, p: number, rawHash: string) => {
      const hash = rawHash.toLowerCase()
      if (awaitingHashesRef.current.has(hash)) return
      awaitingHashesRef.current.add(hash)

      // Auto-expire the await after the timeout budget; clears queue entry
      // so sessionStorage doesn't leak stale hashes across sessions.
      const timer = setTimeout(() => {
        awaitingHashesRef.current.delete(hash)
        awaitingTimeoutsRef.current.delete(hash)
        clearPendingSwapHash(hash)
      }, AWAITING_TIMEOUT_MS)
      awaitingTimeoutsRef.current.set(hash, timer)

      // Immediate silent refetch — don't wait for the next poll tick.
      const controller = new AbortController()
      abortRef.current = controller
      fetchSwaps(addr, p, controller.signal, { silent: true }).then(() => schedulePoll(addr, p))
    },
    [fetchSwaps, schedulePoll]
  )

  // Initial fetch + refetch on address or page change.
  useEffect(() => {
    clearPollTimer()
    if (!address) {
      setSwaps([])
      setPagination(EMPTY_PAGINATION)
      setTotalMiles(0)
      setError(null)
      setIsLoading(false)
      return
    }

    // Replay any swap-submitted events that fired before we mounted (e.g.
    // user swapped on /swap then navigated here). Each hash gets tracked
    // so the first fetch below will kick off fast polling if the DB row
    // hasn't landed yet.
    const replay = getPendingSwapHashes()
    for (const hash of replay) {
      awaitingHashesRef.current.add(hash.toLowerCase())
    }

    const controller = new AbortController()
    abortRef.current = controller

    fetchSwaps(address, page, controller.signal).then(() => schedulePoll(address, page))

    return () => {
      controller.abort()
      clearPollTimer()
      // Clear any outstanding awaiting timers on unmount / address change.
      for (const timer of awaitingTimeoutsRef.current.values()) clearTimeout(timer)
      awaitingTimeoutsRef.current.clear()
      awaitingHashesRef.current.clear()
      prevPendingHashesRef.current.clear()
    }
  }, [address, page, fetchSwaps, schedulePoll, clearPollTimer])

  // Subscribe to live swap-submitted events. When a swap happens while the
  // table is already mounted, start awaiting that hash immediately.
  useEffect(() => {
    if (!address) return
    const unsubscribe = subscribeSwapSubmitted((hash) => {
      startAwaitingHash(address, page, hash)
    })
    return unsubscribe
  }, [address, page, startAwaitingHash])

  // Pause/resume polling based on tab visibility. Only refetches on
  // refocus when there are pending rows or awaiting hashes — fully
  // finalized tables don't trigger any network activity on tab switch.
  useEffect(() => {
    if (!address) return
    const handler = () => {
      if (typeof document === "undefined") return
      if (document.visibilityState === "visible") {
        if (!hasPendingRef.current && awaitingHashesRef.current.size === 0) return
        const controller = new AbortController()
        abortRef.current = controller
        fetchSwaps(address, page, controller.signal, { silent: true }).then(() =>
          schedulePoll(address, page)
        )
      } else {
        clearPollTimer()
      }
    }
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [address, page, fetchSwaps, schedulePoll, clearPollTimer])

  const refetch = useCallback(() => {
    if (!address) return
    const controller = new AbortController()
    abortRef.current = controller
    fetchSwaps(address, page, controller.signal).then(() => schedulePoll(address, page))
  }, [address, page, fetchSwaps, schedulePoll])

  return { swaps, pagination, totalMiles, isLoading, error, refetch }
}
