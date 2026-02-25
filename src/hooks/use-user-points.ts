import { useState, useEffect } from "react"
import { useAccount } from "wagmi"

interface UseUserPointsReturn {
  points: number
  isLoading: boolean
}

export function useUserPoints(): UseUserPointsReturn {
  const { address } = useAccount()
  const [points, setPoints] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setPoints(0)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/fuul/payouts?address=${encodeURIComponent(address)}`)
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
  }, [address])

  return { points, isLoading }
}
