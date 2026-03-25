"use client"

import { useState, useEffect, useRef } from "react"

/**
 * Returns "green" briefly when a balance increases after a swap.
 * Resets when the token address changes (no false flash on token switch).
 * Independent of toast state.
 */
export function useBalanceFlash(
  value: number,
  tokenAddress: string | undefined,
  enabled: boolean = true
): "green" | null {
  const [flash, setFlash] = useState<"green" | null>(null)
  const prevValue = useRef(value)
  const prevToken = useRef(tokenAddress)
  const initialized = useRef(false)

  useEffect(() => {
    // Token changed — reset baseline, no flash
    if (prevToken.current !== tokenAddress) {
      prevToken.current = tokenAddress
      prevValue.current = value
      initialized.current = true
      setFlash(null)
      return
    }

    // Skip initial render
    if (!initialized.current) {
      initialized.current = true
      prevValue.current = value
      return
    }

    if (!enabled || prevValue.current === value) {
      prevValue.current = value
      return
    }

    // Only flash green on increases (tokens arriving)
    if (value > prevValue.current) {
      setFlash("green")
      prevValue.current = value
      const timer = setTimeout(() => setFlash(null), 2000)
      return () => clearTimeout(timer)
    }

    prevValue.current = value
  }, [value, tokenAddress, enabled])

  return flash
}
