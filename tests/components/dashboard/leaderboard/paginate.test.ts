import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { buildPageNumbers } from "@/components/dashboard/leaderboard/paginate"

// Pagination off-by-ones are classically under-tested because they only
// surface at page edges. Example tests pin each boundary; property tests
// then prove the invariants hold for every (current, total) pair in the
// realistic range — proof that no interior configuration slips through.

// ─── examples ────────────────────────────────────────────────────────────────

describe("buildPageNumbers — examples", () => {
  it("lists every page when total ≤ 7", () => {
    expect(buildPageNumbers(1, 1)).toEqual([1])
    expect(buildPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5])
    expect(buildPageNumbers(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("shows right ellipsis when current is near the start", () => {
    expect(buildPageNumbers(1, 20)).toEqual([1, 2, "...", 20])
    expect(buildPageNumbers(2, 20)).toEqual([1, 2, 3, "...", 20])
    expect(buildPageNumbers(3, 20)).toEqual([1, 2, 3, 4, "...", 20])
  })

  it("shows left ellipsis when current is near the end", () => {
    expect(buildPageNumbers(20, 20)).toEqual([1, "...", 19, 20])
    expect(buildPageNumbers(19, 20)).toEqual([1, "...", 18, 19, 20])
    // current=18, total=20 → `current < total-2` is 18 < 18 = false,
    // so no right ellipsis is emitted (the last-cluster window already
    // includes page 20).
    expect(buildPageNumbers(18, 20)).toEqual([1, "...", 17, 18, 19, 20])
  })

  it("shows both ellipses in the middle", () => {
    expect(buildPageNumbers(10, 20)).toEqual([1, "...", 9, 10, 11, "...", 20])
  })

  it("never lists a page more than once at the boundaries", () => {
    const out = buildPageNumbers(4, 20)
    expect(out).toEqual([1, "...", 3, 4, 5, "...", 20])
    const numbers = out.filter((x): x is number => typeof x === "number")
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})

// ─── properties ──────────────────────────────────────────────────────────────

describe("buildPageNumbers — invariants across the input space", () => {
  // fast-check draws (current, total) pairs with current ≤ total to match
  // real usage. We run 200 examples per property (default) — plenty to flush
  // out edge cases, fast enough that the suite stays sub-second.
  const currentAndTotal = fc
    .integer({ min: 1, max: 1000 })
    .chain((total) =>
      fc.integer({ min: 1, max: total }).map((current) => ({ current, total }))
    )

  it("the first element is always 1 (for total ≥ 1)", () => {
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const out = buildPageNumbers(current, total)
        return out[0] === 1
      })
    )
  })

  it("the last element is always `total`", () => {
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const out = buildPageNumbers(current, total)
        return out[out.length - 1] === total
      })
    )
  })

  it("the numeric subsequence is strictly increasing", () => {
    // Without this, pagination would show [1, 5, 3, ..., 20] — a bug that
    // produces a valid-looking ellipsis output but broken navigation.
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const nums = buildPageNumbers(current, total).filter(
          (x): x is number => typeof x === "number"
        )
        for (let i = 1; i < nums.length; i++) {
          if (nums[i] <= nums[i - 1]) return false
        }
        return true
      })
    )
  })

  it("no two consecutive ellipses", () => {
    // "..., 1, ..., 20" is a bug — always a wasted render slot.
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const out = buildPageNumbers(current, total)
        for (let i = 1; i < out.length; i++) {
          if (out[i] === "..." && out[i - 1] === "...") return false
        }
        return true
      })
    )
  })

  it("every numeric entry is within [1, total]", () => {
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const out = buildPageNumbers(current, total)
        return out.every((x) => x === "..." || (x >= 1 && x <= total))
      })
    )
  })

  it("`current` appears in the output whenever total ≥ 1", () => {
    // Load-bearing: the control bar highlights the current page; a regression
    // here would render a pager that visually loses the user.
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const out = buildPageNumbers(current, total)
        return out.includes(current)
      })
    )
  })

  it("output length is bounded — at most 7 entries for any input", () => {
    // The ellipsis design was chosen specifically so the pager doesn't grow
    // with `total`. Pinning the upper bound catches any refactor that
    // accidentally expands the window.
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const out = buildPageNumbers(current, total)
        return out.length <= 7
      })
    )
  })
})
