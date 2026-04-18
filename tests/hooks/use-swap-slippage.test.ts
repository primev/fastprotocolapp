// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSwapSlippage } from "@/hooks/use-swap-slippage"

// Hook tests with happy-dom. Most of this repo's tests run in Node because
// pure logic doesn't need a DOM — but hooks that touch `localStorage` or
// `useEffect` on mount do. The `@vitest-environment happy-dom` directive
// at the top flips just this file to a DOM, leaving the rest of the suite
// fast and node-native.
//
// Why useSwapSlippage is our first hook test:
//   - It owns the clamp math that gates slippage tolerance from the UI to
//     the contract. A regression here either over-tightens (rejects valid
//     slippage) or over-loosens (lets the user lose money).
//   - It persists the deadline to `localStorage`, so the mount-effect
//     round-trip is worth pinning.
//   - It's pure state + side effects; no wagmi or viem dependencies to
//     mock. Ideal hand-off case for the hook-testing pattern.

beforeEach(() => {
  localStorage.clear()
})

describe("useSwapSlippage — defaults and mount", () => {
  it("starts with slippage=0.5 and deadline=30 before mount effect runs", () => {
    const { result } = renderHook(() => useSwapSlippage())
    // The slippage default is synchronous; the deadline comes from state
    // init (30) until the mount effect reads localStorage.
    expect(result.current.slippage).toBe("0.5")
    expect(result.current.deadline).toBe(30)
  })

  it("marks isMounted true after the mount effect", () => {
    const { result } = renderHook(() => useSwapSlippage())
    // renderHook flushes effects synchronously in React 18 concurrent mode
    // under happy-dom, so isMounted flips to true immediately.
    expect(result.current.isMounted).toBe(true)
  })

  it("restores a persisted deadline from localStorage on mount", () => {
    localStorage.setItem("swapDeadline", "60")
    const { result } = renderHook(() => useSwapSlippage())
    expect(result.current.deadline).toBe(60)
  })

  it("clamps a persisted deadline that's below the 5-minute floor", () => {
    // A corrupted localStorage entry must never push the deadline below the
    // contract-accepted minimum — otherwise every subsequent swap reverts.
    localStorage.setItem("swapDeadline", "1")
    const { result } = renderHook(() => useSwapSlippage())
    expect(result.current.deadline).toBe(5)
  })

  it("clamps a persisted deadline that's above the 24-hour ceiling", () => {
    localStorage.setItem("swapDeadline", "9999")
    const { result } = renderHook(() => useSwapSlippage())
    expect(result.current.deadline).toBe(1440)
  })

  it("ignores a NaN localStorage entry", () => {
    localStorage.setItem("swapDeadline", "not-a-number")
    const { result } = renderHook(() => useSwapSlippage())
    expect(result.current.deadline).toBe(30)
  })
})

describe("useSwapSlippage.updateSlippage", () => {
  it("accepts a clean in-range value and rounds to 0.1", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateSlippage("0.75"))
    // 0.75 → 0.8 after rounding to 0.1 step.
    expect(result.current.slippage).toBe("0.8")
  })

  it("caps values above 2%", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateSlippage("5"))
    expect(result.current.slippage).toBe("2")
  })

  it("floors negative input at 0 after stripping the sign", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateSlippage("-0.5"))
    // `-` is stripped by the non-numeric filter, leaving "0.5" → "0.5".
    expect(result.current.slippage).toBe("0.5")
  })

  it("preserves a trailing dot while the user is typing", () => {
    // UX detail: typing "0" then "." then "1" would otherwise snap to "0"
    // mid-keystroke. The clamp intentionally allows a trailing dot.
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateSlippage("1."))
    expect(result.current.slippage).toBe("1.")
  })

  it("strips letters and other garbage characters", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateSlippage("1.2abc"))
    expect(result.current.slippage).toBe("1.2")
  })

  it("returns empty string when the user clears the input", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateSlippage(""))
    expect(result.current.slippage).toBe("")
  })
})

describe("useSwapSlippage.resetSlippage", () => {
  it("restores the 0.5 default", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateSlippage("1.5"))
    expect(result.current.slippage).toBe("1.5")
    act(() => result.current.resetSlippage())
    expect(result.current.slippage).toBe("0.5")
  })
})

describe("useSwapSlippage.updateDeadline", () => {
  it("persists the clamped value to localStorage", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateDeadline(45))
    expect(result.current.deadline).toBe(45)
    expect(localStorage.getItem("swapDeadline")).toBe("45")
  })

  it("clamps to the 5-minute floor before persisting", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateDeadline(2))
    expect(result.current.deadline).toBe(5)
    expect(localStorage.getItem("swapDeadline")).toBe("5")
  })

  it("clamps to the 1440-minute ceiling", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateDeadline(100000))
    expect(result.current.deadline).toBe(1440)
  })

  it("ignores NaN input (keeps current value)", () => {
    const { result } = renderHook(() => useSwapSlippage())
    act(() => result.current.updateDeadline(Number.NaN))
    expect(result.current.deadline).toBe(30)
  })
})
