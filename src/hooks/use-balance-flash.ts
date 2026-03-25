"use client"

import { useState, useEffect, useRef } from "react"

/**
 * Returns true briefly when a numeric balance changes upward.
 * Used to flash/pulse the balance display after tokens arrive.
 */
export function useBalanceFlash(value: number, enabled: boolean = true): boolean {
  const [isFlashing, setIsFlashing] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (!enabled || prevValue.current === value) {
      prevValue.current = value
      return
    }

    // Only flash on increases (tokens arriving, not spending)
    if (value > prevValue.current && prevValue.current > 0) {
      setIsFlashing(true)
      const timer = setTimeout(() => setIsFlashing(false), 1500)
      prevValue.current = value
      return () => clearTimeout(timer)
    }

    prevValue.current = value
  }, [value, enabled])

  return isFlashing
}
