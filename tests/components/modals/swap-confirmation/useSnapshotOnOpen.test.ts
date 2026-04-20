// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useSnapshotOnOpen } from "@/components/modals/swap-confirmation/useSnapshotOnOpen"

// Why pin this hook:
//   - It's the freeze-on-open contract for the swap confirmation modal. The
//     user sees numbers (amountIn, minAmountOut, deadline, exchangeRate)
//     and signs a transaction against them. If the snapshot leaks live
//     quote updates while open, the user signs a tx with different values
//     than the ones they reviewed. That's a money bug, not a UX bug.
//   - It was extracted from 18 lines of inline ref boilerplate. Pinning the
//     semantics here means the next refactor (e.g. memoizing the snapshot
//     or switching to useSyncExternalStore) can't silently regress the
//     freeze behavior.
//
// Security note (from the branch review): the hook does a shallow spread.
// Passing a mutable reference in `values` leaks later mutations into the
// snapshot. We don't test that here because the production code passes
// primitives plus Token object references that get replaced (not mutated)
// — but the one-line comment in useSnapshotOnOpen.ts documents this.

describe("useSnapshotOnOpen — freezes on the open=true edge", () => {
  it("returns the live values when open=false", () => {
    const { result } = renderHook(({ open, values }) => useSnapshotOnOpen(open, values), {
      initialProps: { open: false, values: { amount: "1.0", deadline: 30 } },
    })
    expect(result.current).toEqual({ amount: "1.0", deadline: 30 })
  })

  it("returns a frozen snapshot of the values the render open flipped to true", () => {
    const { result, rerender } = renderHook(
      ({ open, values }) => useSnapshotOnOpen(open, values),
      {
        initialProps: {
          open: false,
          values: { amount: "1.0", deadline: 30, minAmountOut: "2500" },
        },
      }
    )
    // Modal not open yet — snapshot is just the live values.
    expect(result.current).toEqual({ amount: "1.0", deadline: 30, minAmountOut: "2500" })

    // Flip open → true with a specific set of values.
    rerender({
      open: true,
      values: { amount: "2.0", deadline: 45, minAmountOut: "5000" },
    })
    expect(result.current).toEqual({ amount: "2.0", deadline: 45, minAmountOut: "5000" })

    // Re-render with DIFFERENT live values while open stays true.
    // The snapshot must stick; live updates are not allowed to leak through.
    rerender({
      open: true,
      values: { amount: "999.0", deadline: 9999, minAmountOut: "999999" },
    })
    expect(result.current).toEqual({ amount: "2.0", deadline: 45, minAmountOut: "5000" })
  })

  it("clears the snapshot when open falls back to false", () => {
    // When the modal closes, the snapshot must clear so the next opening
    // captures fresh values. A stale snapshot after close would feed the
    // next render a freeze of the previous session's review.
    const { result, rerender } = renderHook(
      ({ open, values }) => useSnapshotOnOpen(open, values),
      { initialProps: { open: true, values: { amount: "1.0" } } }
    )
    // Opening on first render — snapshot captures.
    expect(result.current).toEqual({ amount: "1.0" })

    // Close: snapshot clears, live values pass through.
    rerender({ open: false, values: { amount: "2.0" } })
    expect(result.current).toEqual({ amount: "2.0" })

    // Reopen: the NEW live values get snapshotted (not the old frozen ones).
    rerender({ open: true, values: { amount: "3.0" } })
    expect(result.current).toEqual({ amount: "3.0" })

    // Live changes while re-open are ignored as before.
    rerender({ open: true, values: { amount: "4.0" } })
    expect(result.current).toEqual({ amount: "3.0" })
  })

  it("does not re-capture when open stays true across renders", () => {
    // The capture only happens on the closed → open edge. Once captured,
    // subsequent open=true renders must return the SAME snapshot object
    // — a regression that re-spreads on every render would let live
    // updates leak through one at a time (cumulative drift).
    //
    // Note: `initialProps: { open: true }` does NOT produce an edge —
    // `wasOpenRef` initializes to `open` on first render, so the capture
    // only fires when open transitions from false to true. We start with
    // open=false here to get a clean edge.
    const { result, rerender } = renderHook(
      ({ open, values }) => useSnapshotOnOpen(open, values),
      { initialProps: { open: false, values: { amount: "1.0" } } }
    )
    rerender({ open: true, values: { amount: "1.0" } })
    const afterCapture = result.current

    // Rerender with a new `values` reference (same contents). The hook
    // must keep returning the captured snapshot, NOT re-spread from the
    // new `values` object.
    rerender({ open: true, values: { amount: "1.0" } })
    expect(result.current).toBe(afterCapture)

    // Same check with DIFFERENT live contents — still the captured one.
    rerender({ open: true, values: { amount: "999.0" } })
    expect(result.current).toBe(afterCapture)
  })

  it("deep-clones so later mutations to nested objects don't leak into the snapshot", () => {
    // The tokenIn / tokenOut values passed by SwapConfirmationModal are Token
    // object references, not primitives. If a downstream token-list refetch
    // mutated those objects in place (e.g. corrected a stale `decimals`
    // field), a shallow snapshot would see the mutation and the user would
    // sign a tx with different values than they reviewed. The `structuredClone`
    // call in the hook is what prevents that. This test locks it.
    const token = { address: "0xabc", symbol: "USDC", decimals: 6 }
    const { result, rerender } = renderHook(
      ({ open, values }: { open: boolean; values: { t: typeof token } }) =>
        useSnapshotOnOpen(open, values),
      { initialProps: { open: false, values: { t: token } } }
    )
    rerender({ open: true, values: { t: token } })
    // Snapshot captured — before any mutation, both snapshot and live see
    // decimals=6.
    expect(result.current.t.decimals).toBe(6)

    // Simulate a downstream mutation of the live token object. A shallow
    // spread would let this through; the deep clone must block it.
    token.decimals = 99

    // Snapshot must still read the original value.
    expect(result.current.t.decimals).toBe(6)
  })

  it("is total — open toggling at any cadence never throws", () => {
    const { rerender } = renderHook(
      ({ open, values }) => useSnapshotOnOpen(open, values),
      { initialProps: { open: false, values: { a: 1 } } }
    )
    // Simulate a rapid open/close pattern (modal double-click) — no state
    // errors or exceptions expected.
    for (let i = 0; i < 20; i++) {
      rerender({ open: i % 2 === 0, values: { a: i } })
    }
  })
})
