// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useQuoteGuardConfig } from "@/hooks/use-quote-guard-config"

// Why pin this hook:
//   - Its defaults (25% divergence, 1.5% treasury margin) are the last-line
//     safety net if Edge Config is unreachable. A silent regression to
//     `undefined` here would let the min-amount-out guard collapse and ship
//     the swap with zero protection.
//   - The fetch happens in a mount effect that must tolerate a missing
//     endpoint, a non-OK response, a JSON parse error, or malformed fields
//     without throwing — every branch below corresponds to one of those.
//   - Unmount-before-response must not call setState (the `cancelled` flag
//     path), otherwise React logs warnings in production and leaks memory
//     under a mounting/unmounting pattern like tab-switching.

const DEFAULTS = { divergenceThresholdPct: 25, treasuryMarginPct: 1.5 }

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mockFetchOnce(body: unknown, ok = true) {
  ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    json: async () => body,
  })
}

function mockFetchReject(err: unknown) {
  ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err)
}

describe("useQuoteGuardConfig — defaults", () => {
  it("returns built-in defaults on first render before fetch resolves", () => {
    // Never-resolving fetch so the mount effect cannot overwrite defaults.
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise(() => {})
    )
    const { result } = renderHook(() => useQuoteGuardConfig())
    expect(result.current).toEqual(DEFAULTS)
  })
})

describe("useQuoteGuardConfig — fetch success", () => {
  it("replaces defaults with a valid Edge Config payload", async () => {
    mockFetchOnce({ divergenceThresholdPct: 12, treasuryMarginPct: 0.3 })
    const { result } = renderHook(() => useQuoteGuardConfig())
    await waitFor(() =>
      expect(result.current).toEqual({
        divergenceThresholdPct: 12,
        treasuryMarginPct: 0.3,
      })
    )
  })

  it("accepts treasuryMarginPct === 0 (exact boundary — no margin)", async () => {
    // The hook's guard is `>= 0` for treasuryMargin; 0 is a legitimate value
    // meaning "use barter output as-is" and must not be rejected.
    mockFetchOnce({ divergenceThresholdPct: 10, treasuryMarginPct: 0 })
    const { result } = renderHook(() => useQuoteGuardConfig())
    await waitFor(() => expect(result.current.treasuryMarginPct).toBe(0))
    expect(result.current.divergenceThresholdPct).toBe(10)
  })
})

describe("useQuoteGuardConfig — malformed payloads", () => {
  it("falls back to default divergenceThresholdPct when it is 0", async () => {
    // Divergence threshold guard is `> 0`, because 0 would cause the fallback
    // to trigger on every quote — effectively disabling Uniswap references.
    mockFetchOnce({ divergenceThresholdPct: 0, treasuryMarginPct: 2 })
    const { result } = renderHook(() => useQuoteGuardConfig())
    await waitFor(() => expect(result.current.treasuryMarginPct).toBe(2))
    expect(result.current.divergenceThresholdPct).toBe(DEFAULTS.divergenceThresholdPct)
  })

  it("falls back to default treasuryMarginPct when it is negative", async () => {
    mockFetchOnce({ divergenceThresholdPct: 15, treasuryMarginPct: -0.5 })
    const { result } = renderHook(() => useQuoteGuardConfig())
    await waitFor(() => expect(result.current.divergenceThresholdPct).toBe(15))
    expect(result.current.treasuryMarginPct).toBe(DEFAULTS.treasuryMarginPct)
  })

  it("falls back to both defaults when fields are wrong types", async () => {
    mockFetchOnce({ divergenceThresholdPct: "25", treasuryMarginPct: null })
    const { result } = renderHook(() => useQuoteGuardConfig())
    // Wait a tick so the effect's setState has a chance to run (it shouldn't
    // flip the values, but waitFor gives the fetch promise time to settle).
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/config/quote-guard")
    )
    expect(result.current).toEqual(DEFAULTS)
  })

  it("falls back to defaults when fields are missing entirely", async () => {
    mockFetchOnce({})
    const { result } = renderHook(() => useQuoteGuardConfig())
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/config/quote-guard")
    )
    expect(result.current).toEqual(DEFAULTS)
  })
})

describe("useQuoteGuardConfig — error paths", () => {
  it("keeps defaults when the response is not ok", async () => {
    mockFetchOnce({ divergenceThresholdPct: 999, treasuryMarginPct: 999 }, false)
    const { result } = renderHook(() => useQuoteGuardConfig())
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/config/quote-guard")
    )
    expect(result.current).toEqual(DEFAULTS)
  })

  it("keeps defaults when fetch rejects (e.g. network error)", async () => {
    mockFetchReject(new Error("offline"))
    const { result } = renderHook(() => useQuoteGuardConfig())
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/config/quote-guard")
    )
    expect(result.current).toEqual(DEFAULTS)
  })
})

describe("useQuoteGuardConfig — cancellation", () => {
  it("does not call setState if the hook unmounts before fetch resolves", async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = (body) =>
          resolve({
            ok: true,
            json: async () => body,
          })
      })
    )

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { result, unmount } = renderHook(() => useQuoteGuardConfig())
    unmount()
    // Resolve AFTER unmount; the `cancelled` flag must short-circuit.
    resolveFetch({ divergenceThresholdPct: 77, treasuryMarginPct: 7 })
    // Yield to microtasks so the promise chain runs.
    await new Promise((r) => setTimeout(r, 0))
    // We snapshot `result.current` once before unmount; it should still be
    // the defaults and no React warning should have been logged.
    expect(result.current).toEqual(DEFAULTS)
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
