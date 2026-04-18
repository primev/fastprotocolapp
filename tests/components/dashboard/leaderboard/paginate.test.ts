import { describe, it, expect } from "vitest"
import { buildPageNumbers } from "@/components/dashboard/leaderboard/paginate"

// Pagination off-by-ones are classically under-tested because they only
// surface at page edges (page 1, page N, page 2, page N-1). We pin each
// boundary here so a well-intentioned refactor can't silently reintroduce
// the "page 7 of 7 missing" bug that hit the leaderboard before.

describe("buildPageNumbers", () => {
  it("lists every page when total ≤ 7", () => {
    expect(buildPageNumbers(1, 1)).toEqual([1])
    expect(buildPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5])
    expect(buildPageNumbers(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("shows right ellipsis when current is near the start", () => {
    // current=1 on a 20-page total → [1, 2, "...", 20]
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
    // current=10 of 20 → 1, ..., 9, 10, 11, ..., 20
    expect(buildPageNumbers(10, 20)).toEqual([1, "...", 9, 10, 11, "...", 20])
  })

  it("never lists a page more than once at the boundaries", () => {
    const out = buildPageNumbers(4, 20)
    expect(out).toEqual([1, "...", 3, 4, 5, "...", 20])
    // No duplicates.
    const numbers = out.filter((x): x is number => typeof x === "number")
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})
