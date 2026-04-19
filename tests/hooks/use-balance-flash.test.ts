// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useBalanceFlash } from "@/hooks/use-balance-flash"

// Why pin this hook:
//   - It is the visual confirmation that a swap credited the user's balance.
//     A regression that flashes on every token switch (false positive) teaches
//     users to ignore the signal; a regression that never flashes (false
//     negative) erodes trust that the swap actually moved tokens.
//   - The 2000ms auto-clear is a contract with the UI layout — a longer
//     linger can overlap the next swap's confirmation; a shorter one drops
//     below human perception. Pin it.
//   - Token-change reset is what distinguishes this hook from a generic
//     "did value increase" hook. That branch must never leak a flash.

const TOKEN_A = "0xAAAA000000000000000000000000000000000000"
const TOKEN_B = "0xBBBB000000000000000000000000000000000000"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useBalanceFlash — initial render", () => {
  it("does not flash on first render (baseline only)", () => {
    const { result } = renderHook(() => useBalanceFlash(100, TOKEN_A))
    expect(result.current).toBeNull()
  })
})

describe("useBalanceFlash — increases", () => {
  it("flashes green when value increases", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useBalanceFlash(value, TOKEN_A),
      { initialProps: { value: 100 } }
    )
    expect(result.current).toBeNull()
    rerender({ value: 150 })
    expect(result.current).toBe("green")
  })

  it("clears the flash after the 2000ms window", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useBalanceFlash(value, TOKEN_A),
      { initialProps: { value: 100 } }
    )
    rerender({ value: 200 })
    expect(result.current).toBe("green")
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    // One tick before the ceiling — still green.
    expect(result.current).toBe("green")
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBeNull()
  })
})

describe("useBalanceFlash — non-increases", () => {
  it("does not flash when value stays the same", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useBalanceFlash(value, TOKEN_A),
      { initialProps: { value: 100 } }
    )
    rerender({ value: 100 })
    expect(result.current).toBeNull()
  })

  it("does not flash when value decreases (e.g. user paid)", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useBalanceFlash(value, TOKEN_A),
      { initialProps: { value: 100 } }
    )
    rerender({ value: 50 })
    expect(result.current).toBeNull()
  })
})

describe("useBalanceFlash — token changes", () => {
  it("does not flash when the token changes, even if the new balance is larger", () => {
    // User switches from a 100-unit token A to a 9999-unit token B.
    // Without the reset branch, this would fire a false "green" signal.
    const { result, rerender } = renderHook(
      ({ value, token }: { value: number; token: string }) =>
        useBalanceFlash(value, token),
      { initialProps: { value: 100, token: TOKEN_A } }
    )
    rerender({ value: 9999, token: TOKEN_B })
    expect(result.current).toBeNull()
  })

  it("re-baselines on token switch so a later increase still flashes", () => {
    const { result, rerender } = renderHook(
      ({ value, token }: { value: number; token: string }) =>
        useBalanceFlash(value, token),
      { initialProps: { value: 100, token: TOKEN_A } }
    )
    rerender({ value: 50, token: TOKEN_B })
    expect(result.current).toBeNull()
    rerender({ value: 75, token: TOKEN_B })
    expect(result.current).toBe("green")
  })
})

describe("useBalanceFlash — disabled", () => {
  it("does not flash while enabled=false, even on increase", () => {
    const { result, rerender } = renderHook(
      ({ value, enabled }: { value: number; enabled: boolean }) =>
        useBalanceFlash(value, TOKEN_A, enabled),
      { initialProps: { value: 100, enabled: false } }
    )
    rerender({ value: 200, enabled: false })
    expect(result.current).toBeNull()
  })

  it("resumes flashing on the next increase once re-enabled", () => {
    const { result, rerender } = renderHook(
      ({ value, enabled }: { value: number; enabled: boolean }) =>
        useBalanceFlash(value, TOKEN_A, enabled),
      { initialProps: { value: 100, enabled: false } }
    )
    rerender({ value: 200, enabled: false }) // baseline advances silently
    rerender({ value: 250, enabled: true })
    expect(result.current).toBe("green")
  })
})
