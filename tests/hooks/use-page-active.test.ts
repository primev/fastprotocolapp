// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePageActive } from "@/hooks/use-page-active"

// Why pin this hook:
//   - It gates every polling loop in the dashboard. A regression that always
//     returns true burns RPC quota and trips rate limits; one that always
//     returns false freezes the UI on idle-adjacent users.
//   - The 2-minute idle threshold is a product decision, not a detail. If
//     someone shortens it, the leaderboard stalls mid-read. Lock it.
//   - Cleanup matters: the hook registers six document-level listeners. If
//     unmount leaks them, StrictMode remounting stacks N listeners per
//     mount, and a single navigation regenerates multiple timers.

const IDLE_MS = 2 * 60 * 1000

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  })
  document.dispatchEvent(new Event("visibilitychange"))
}

beforeEach(() => {
  vi.useFakeTimers()
  setHidden(false)
})

afterEach(() => {
  vi.useRealTimers()
  setHidden(false)
})

describe("usePageActive — initial state", () => {
  it("returns true when the page is visible and the user just loaded", () => {
    const { result } = renderHook(() => usePageActive())
    expect(result.current).toBe(true)
  })
})

describe("usePageActive — visibility", () => {
  it("returns false when the document becomes hidden", () => {
    const { result } = renderHook(() => usePageActive())
    act(() => setHidden(true))
    expect(result.current).toBe(false)
  })

  it("returns true again when the user returns to the tab (before idle)", () => {
    const { result } = renderHook(() => usePageActive())
    act(() => setHidden(true))
    expect(result.current).toBe(false)
    act(() => setHidden(false))
    expect(result.current).toBe(true)
  })
})

describe("usePageActive — idle timer", () => {
  it("returns false after 2 minutes without activity", () => {
    const { result } = renderHook(() => usePageActive())
    act(() => {
      vi.advanceTimersByTime(IDLE_MS - 1)
    })
    expect(result.current).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })

  it("resets the idle timer when the user moves the mouse", () => {
    const { result } = renderHook(() => usePageActive())
    // Walk most of the way to idle, then interrupt with activity.
    act(() => {
      vi.advanceTimersByTime(IDLE_MS - 100)
    })
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove"))
    })
    // Another 100ms is not enough — the timer was reset.
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe(true)
    // But a full IDLE_MS from the reset does trip it.
    act(() => {
      vi.advanceTimersByTime(IDLE_MS)
    })
    expect(result.current).toBe(false)
  })

  it.each(["mousedown", "keydown", "scroll", "touchstart", "pointerdown"])(
    "resets the idle timer on %s",
    (eventName) => {
      const { result } = renderHook(() => usePageActive())
      act(() => {
        vi.advanceTimersByTime(IDLE_MS - 10)
      })
      act(() => {
        document.dispatchEvent(new Event(eventName))
      })
      act(() => {
        vi.advanceTimersByTime(IDLE_MS - 10)
      })
      expect(result.current).toBe(true)
    }
  )
})

describe("usePageActive — combined state", () => {
  it("is false when hidden even if the idle timer has not elapsed", () => {
    const { result } = renderHook(() => usePageActive())
    act(() => setHidden(true))
    expect(result.current).toBe(false)
  })

  it("is false when idle even if the page is visible", () => {
    const { result } = renderHook(() => usePageActive())
    act(() => {
      vi.advanceTimersByTime(IDLE_MS)
    })
    expect(result.current).toBe(false)
  })
})

describe("usePageActive — cleanup", () => {
  it("removes activity and visibility listeners on unmount", () => {
    const addSpy = vi.spyOn(document, "addEventListener")
    const removeSpy = vi.spyOn(document, "removeEventListener")

    const { unmount } = renderHook(() => usePageActive())
    const addedEvents = addSpy.mock.calls.map((c) => c[0])

    unmount()

    const removedEvents = removeSpy.mock.calls.map((c) => c[0])
    for (const e of ["visibilitychange", "mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointerdown"]) {
      expect(addedEvents).toContain(e)
      expect(removedEvents).toContain(e)
    }
  })

  it("clears the pending idle timer on unmount (no stray setState warnings)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { unmount } = renderHook(() => usePageActive())
    unmount()
    act(() => {
      vi.advanceTimersByTime(IDLE_MS * 2)
    })
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
