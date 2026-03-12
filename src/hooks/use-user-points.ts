import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"

const REFETCH_MILES_EVENT = "refetch-user-miles"

interface UseUserPointsReturn {
  points: number
  isLoading: boolean
}

/** Trigger a miles refetch from anywhere (e.g. after a successful swap). */
export function refetchMiles() {
  window.dispatchEvent(new Event(REFETCH_MILES_EVENT))
}

export function useUserPoints(): UseUserPointsReturn {
  const { address } = useAccount()
  const [points, setPoints] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchPoints = useCallback((addr: string) => {
    let cancelled = false
    setIsLoading(true)

    fetch(`/api/fuul/payouts?address=${encodeURIComponent(addr)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        if (json?.success && typeof json.totalPoints === "number") {
          setPoints(json.totalPoints)
        } else {
          setPoints(0)
        }
      })
      .catch(() => {
        if (!cancelled) setPoints(0)
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
      setPoints(0)
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

  return { points, isLoading }
}
