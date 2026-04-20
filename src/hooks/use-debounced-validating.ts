"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Debouncer for loading signals: latches `raw` ON immediately, but holds it
 * ON for at least `minDisplayMs` before allowing a falling edge. Prevents
 * the swap button's "Calculating..." label from flickering when quote +
 * barter validation race to under the UX-perceptible threshold.
 *
 * Semantics:
 *   - raw false → false    (nothing to latch)
 *   - raw true  → true     (immediately)
 *   - raw true → false     → true for remaining budget, then false
 *   - subsequent raw=true within the budget cancels the pending fall-through
 *     and resets the timestamp window.
 *
 * The default 500 ms matches the swap form's original threshold. The
 * constant ships with the hook so callers can override for tests or
 * different UX cadences.
 */
export const DEFAULT_VALIDATING_MIN_DISPLAY_MS = 500

export function useDebouncedValidating(
  raw: boolean,
  minDisplayMs = DEFAULT_VALIDATING_MIN_DISPLAY_MS
): boolean {
  const [debounced, setDebounced] = useState(false)
  const latchedAtRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (raw) {
      // Rising edge (or steady-true): show immediately, record the latch time
      // so the falling-edge branch can compute the remaining display budget.
      clearTimeout(timerRef.current)
      setDebounced(true)
      latchedAtRef.current = Date.now()
      return
    }
    // Falling edge: only schedule a fall-through if we're currently latched.
    if (!debounced) return
    const elapsed = Date.now() - latchedAtRef.current
    const remaining = minDisplayMs - elapsed
    if (remaining > 0) {
      timerRef.current = setTimeout(() => setDebounced(false), remaining)
    } else {
      setDebounced(false)
    }
    return () => clearTimeout(timerRef.current)
    // `debounced` is read inside the effect but intentionally not a dep —
    // changing `debounced` as a side-effect of this effect would retrigger
    // and re-latch. The `raw` edge drives all transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, minDisplayMs])

  return debounced
}
