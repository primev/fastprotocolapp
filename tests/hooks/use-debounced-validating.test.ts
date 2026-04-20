// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import fc from "fast-check"
import {
  useDebouncedValidating,
  DEFAULT_VALIDATING_MIN_DISPLAY_MS,
} from "@/hooks/use-debounced-validating"

// Why pin this hook:
//   - It owns the "Calculating..." label's flicker guard on the swap button.
//     A regression that shortens the latch makes the label strobe when quote
//     + barter validation race to <500 ms. One that lengthens it makes the
//     UI feel stuck.
//   - Extracted from use-swap-form so the hooks-god-file shrinks and this
//     piece gets independently verified instead of relying on manual QA.
//   - Pure state machine over time + a single boolean input — ideal for a
//     property test driving random raw-edge sequences through fake timers.

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useDebouncedValidating — edge semantics", () => {
  it("starts false when raw is false", () => {
    const { result } = renderHook(() => useDebouncedValidating(false))
    expect(result.current).toBe(false)
  })

  it("starts true when raw is true on first render", () => {
    const { result } = renderHook(() => useDebouncedValidating(true))
    expect(result.current).toBe(true)
  })

  it("latches to true immediately on a rising edge", () => {
    const { result, rerender } = renderHook(({ raw }: { raw: boolean }) => useDebouncedValidating(raw), {
      initialProps: { raw: false },
    })
    rerender({ raw: true })
    expect(result.current).toBe(true)
  })

  it("holds true for the full minimum display window after a falling edge", () => {
    const { result, rerender } = renderHook(({ raw }: { raw: boolean }) => useDebouncedValidating(raw), {
      initialProps: { raw: true },
    })
    expect(result.current).toBe(true)
    rerender({ raw: false })
    // Immediately after the falling edge we must still read true (window unspent).
    expect(result.current).toBe(true)
    act(() => {
      vi.advanceTimersByTime(DEFAULT_VALIDATING_MIN_DISPLAY_MS - 1)
    })
    // One tick before the threshold — still latched.
    expect(result.current).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })

  it("falls through instantly when raw was true for longer than the window", () => {
    const { result, rerender } = renderHook(({ raw }: { raw: boolean }) => useDebouncedValidating(raw), {
      initialProps: { raw: true },
    })
    act(() => {
      vi.advanceTimersByTime(DEFAULT_VALIDATING_MIN_DISPLAY_MS * 2)
    })
    rerender({ raw: false })
    // Budget already elapsed — the falling edge resolves synchronously.
    expect(result.current).toBe(false)
  })

  it("cancels a pending fall-through when raw rises back true within the window", () => {
    const { result, rerender } = renderHook(({ raw }: { raw: boolean }) => useDebouncedValidating(raw), {
      initialProps: { raw: true },
    })
    rerender({ raw: false })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // New rising edge within the pending window — latch should re-arm.
    rerender({ raw: true })
    expect(result.current).toBe(true)
    // Advance past the ORIGINAL window. Still latched because the re-arm
    // reset the timer; the pending fall-through was cancelled.
    act(() => {
      vi.advanceTimersByTime(DEFAULT_VALIDATING_MIN_DISPLAY_MS)
    })
    expect(result.current).toBe(true)
  })

  it("respects a custom minDisplayMs override", () => {
    const { result, rerender } = renderHook(
      ({ raw }: { raw: boolean }) => useDebouncedValidating(raw, 1000),
      { initialProps: { raw: true } }
    )
    rerender({ raw: false })
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })
})

describe("useDebouncedValidating — invariants under random edge sequences", () => {
  it("debounced is true whenever raw is true (no false negatives)", () => {
    // Generate a sequence of (raw, dtMs) steps and verify the invariant:
    // if raw was ever true at any point in the current "latched window",
    // debounced must be true. A regression that skips the latch on rapid
    // rising edges would violate this.
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            raw: fc.boolean(),
            dtMs: fc.integer({ min: 0, max: 2000 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (steps) => {
          vi.useFakeTimers()
          try {
            const first = steps[0]!
            const { result, rerender } = renderHook(
              ({ raw }: { raw: boolean }) => useDebouncedValidating(raw),
              { initialProps: { raw: first.raw } }
            )
            // Initial check: if raw starts true, debounced must be true.
            if (first.raw && result.current !== true) return false
            for (const step of steps.slice(1)) {
              rerender({ raw: step.raw })
              if (step.raw && result.current !== true) return false
              act(() => {
                vi.advanceTimersByTime(step.dtMs)
              })
            }
            return true
          } finally {
            vi.useRealTimers()
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})
