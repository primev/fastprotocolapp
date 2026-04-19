"use client"

import { useState, useEffect } from "react"

const DEFAULT_SURPLUS_RATE = 0.0056

/**
 * Fetches the surplus rate from Edge Config (p25 across all processed swaps,
 * updated daily by cron). Returns the default fallback until the fetch completes.
 */
export function useSurplusRate(): number {
  const [rate, setRate] = useState(DEFAULT_SURPLUS_RATE)

  useEffect(() => {
    let cancelled = false

    const fetchRate = async () => {
      try {
        const res = await fetch("/api/config/gas-estimate")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && typeof data.surplusRate === "number" && data.surplusRate > 0) {
          setRate(data.surplusRate)
        }
      } catch {
        // Fallback is already set
      }
    }

    fetchRate()
    return () => {
      cancelled = true
    }
  }, [])

  return rate
}
