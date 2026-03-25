"use client"

import { useState, useEffect, useRef } from "react"

/**
 * Returns a color hint when a balance changes after a swap:
 * - "green" when balance increases (tokens arrived)
 * - "red" when balance decreases (tokens sent)
 * - null when idle
 *
 * Flashes for 2s then resets. Independent of toast state.
 */
export function useBalanceFlash(
  value: number,
  enabled: boolean = true
): "green" | "red" | null {
  const [flash, setFlash] = useState<"green" | "red" | null>(null)
  const prevValue = useRef(value)
  const initialized = useRef(false)

  useEffect(() => {
    // Skip the very first render — don't flash on initial load
    if (!initialized.current) {
      initialized.current = true
      prevValue.current = value
      return
    }

    if (!enabled || prevValue.current === value) {
      prevValue.current = value
      return
    }

    const color = value > prevValue.current ? "green" : "red"
    setFlash(color)
    prevValue.current = value

    const timer = setTimeout(() => setFlash(null), 2000)
    return () => clearTimeout(timer)
  }, [value, enabled])

  return flash
}
