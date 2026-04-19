import { useState, useEffect, useCallback, useRef } from "react"
import { useAccount } from "wagmi"
import { REFETCH_MILES_EVENT, refetchMiles } from "@/lib/miles-events"
import { getPendingSwapHashes, subscribeSwapSubmitted } from "@/lib/swap-events"

export { REFETCH_MILES_EVENT, refetchMiles }

interface UseUserPointsReturn {
  points: number
  isLoading: boolean
}

/** Poll cadence for refreshing miles after a swap submission. */
const POST_SWAP_POLL_INTERVAL_MS = 10_000
/** Give up polling after this long if the value still hasn't changed. */
const POST_SWAP_POLL_BUDGET_MS = 3 * 60 * 1000

export function useUserPoints(): UseUserPointsReturn {
  const { address } = useAccount()
  const [payoutPoints, setPayoutPoints] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // The header reads from /payouts/totals/{address}, the per-user Fuul
  // endpoint that updates as soon as Fuul indexes the settlement. The
  // leaderboard data is computed on a slower cadence by Fuul, so we let
  // the badge update first and the leaderboard table catch up afterward
  // (both share refetch-user-miles, so they refresh in the same cycle).

  const fetchPoints = useCallback((addr: string) => {
    let cancelled = false
    setIsLoading(true)

    fetch(`/api/fuul/payouts?address=${encodeURIComponent(addr)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        if (json?.success && typeof json.totalPoints === "number") {
          setPayoutPoints(json.totalPoints)
        } else {
          setPayoutPoints(0)
        }
      })
      .catch(() => {
        if (!cancelled) setPayoutPoints(0)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Initial fetch + refetch on address change
  useEffect(() => {
    if (!address) {
      setPayoutPoints(0)
      setIsLoading(false)
      return
    }
    return fetchPoints(address)
  }, [address, fetchPoints])

  // Listen for refetch events (e.g. after successful swap)
  useEffect(() => {
    if (!address) return
    const handler = () => fetchPoints(address)
    window.addEventListener(REFETCH_MILES_EVENT, handler)
    return () => window.removeEventListener(REFETCH_MILES_EVENT, handler)
  }, [address, fetchPoints])

  // Track the latest points value so the post-swap poller can detect a
  // change without re-subscribing on every render.
  const points = payoutPoints
  const latestPointsRef = useRef(points)
  useEffect(() => {
    latestPointsRef.current = points
  }, [points])

  // Active poll-loop bookkeeping. Settlement (and Fuul indexing of it) can
  // take ~30s+ after a swap is submitted — well past the single 5s
  // refetchMiles() that SwapConfirmationModal fires. Without this loop the
  // header never updates unless the user is on the dashboard (where
  // useUserSwaps does its own pending→processed detection).
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollDeadlineRef = useRef<number>(0)
  const baselineRef = useRef<number>(0)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    // Extend the budget on each new swap submission. Capture the current
    // points value as the baseline; we stop as soon as it changes.
    pollDeadlineRef.current = Date.now() + POST_SWAP_POLL_BUDGET_MS
    baselineRef.current = latestPointsRef.current

    if (pollTimerRef.current != null) return // already polling

    pollTimerRef.current = setInterval(() => {
      if (Date.now() >= pollDeadlineRef.current) {
        stopPolling()
        return
      }
      if (latestPointsRef.current !== baselineRef.current) {
        stopPolling()
        return
      }
      refetchMiles()
    }, POST_SWAP_POLL_INTERVAL_MS)
  }, [stopPolling])

  // Watch for swap submissions globally so the header refreshes even if
  // the user never visits the dashboard. Also resume polling on mount if
  // sessionStorage shows pending hashes from before this hook mounted.
  useEffect(() => {
    if (!address) return
    if (getPendingSwapHashes().length > 0) startPolling()
    const unsubscribe = subscribeSwapSubmitted(() => startPolling())
    return () => {
      unsubscribe()
      stopPolling()
    }
  }, [address, startPolling, stopPolling])

  return { points, isLoading }
}
