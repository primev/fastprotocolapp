import { describe, it, expect } from "vitest"
import fc from "fast-check"
import {
  computeAppliedSlippagePct,
  computeAppliedSlippageBps,
  DEFAULT_BARTER_BUFFER_PCT,
} from "@/lib/swap/min-amount-out"
import { SLIPPAGE_MAX_PCT, computeSlippageLimit } from "@/lib/swap/slippage"

// Swap-form minAmountOut picker.
//
// This module chooses the slippage percent that ends up controlling
// `minAmountOut` when a user clicks Swap. Getting it wrong in either
// direction is bad:
//
//   - Too tight → swap reverts on-chain because Barter's actual routing
//     output is slightly below our floor. User eats gas, no refund.
//   - Too loose → user takes more slippage than they configured. Worst
//     case the settlement contract fills at a materially worse price.
//
// Example tests pin the named cases the product team has reasoned about;
// property tests pin invariants across the full input space so no edge
// case sneaks past.

// ─── computeAppliedSlippagePct — examples ────────────────────────────────────

describe("computeAppliedSlippagePct — named cases", () => {
  it("returns the user's slippage when there's no Barter shortfall", () => {
    expect(
      computeAppliedSlippagePct({ userSlippagePct: 0.5, barterShortfallPct: 0 })
    ).toBe(0.5)
  })

  it("raises the floor to shortfall+buffer when Barter reports a shortfall", () => {
    // User asked for 0.5%, Barter says it's 0.8% short → floor should be
    // 0.8 + 0.5 = 1.3% (applied = max of user and floor).
    expect(
      computeAppliedSlippagePct({ userSlippagePct: 0.5, barterShortfallPct: 0.8 })
    ).toBe(1.3)
  })

  it("keeps user's slippage when it already exceeds Barter's floor", () => {
    expect(
      computeAppliedSlippagePct({ userSlippagePct: 1.5, barterShortfallPct: 0.2 })
    ).toBe(1.5)
  })

  it("caps at the configured max", () => {
    // Max defaults to SLIPPAGE_MAX_PCT; here we pass an explicit 2% cap
    // (the use-swap-form convention).
    expect(
      computeAppliedSlippagePct({
        userSlippagePct: 5,
        barterShortfallPct: 0,
        maxSlippagePct: 2,
      })
    ).toBe(2)
    expect(
      computeAppliedSlippagePct({
        userSlippagePct: 0.1,
        barterShortfallPct: 3,
        maxSlippagePct: 2,
      })
    ).toBe(2)
  })

  it("treats NaN and negative inputs as zero (typing in progress)", () => {
    expect(
      computeAppliedSlippagePct({ userSlippagePct: Number.NaN, barterShortfallPct: 0 })
    ).toBe(0)
    expect(
      computeAppliedSlippagePct({ userSlippagePct: -1, barterShortfallPct: 0 })
    ).toBe(0)
    expect(
      computeAppliedSlippagePct({ userSlippagePct: 0.5, barterShortfallPct: Number.NaN })
    ).toBe(0.5)
  })
})

// ─── computeAppliedSlippagePct — properties ──────────────────────────────────

describe("computeAppliedSlippagePct — invariants across the input space", () => {
  // Valid in-range inputs. fast-check will sample ~100 pairs per property.
  const validInputs = fc.record({
    userSlippagePct: fc.double({ min: 0, max: 50, noNaN: true }),
    barterShortfallPct: fc.double({ min: 0, max: 50, noNaN: true }),
    maxSlippagePct: fc.double({ min: 0.1, max: 50, noNaN: true }),
  })

  it("output is always in [0, maxSlippagePct]", () => {
    fc.assert(
      fc.property(validInputs, (params) => {
        const out = computeAppliedSlippagePct(params)
        return out >= 0 && out <= params.maxSlippagePct
      })
    )
  })

  it("output is never below userSlippagePct (when user ≤ max)", () => {
    // Load-bearing: if the user asked for 1%, the floor must never drop
    // BELOW 1% — that would silently tighten their tolerance without
    // their consent.
    fc.assert(
      fc.property(validInputs, (params) => {
        if (params.userSlippagePct > params.maxSlippagePct) return true // skip; cap kicks in
        const out = computeAppliedSlippagePct(params)
        return out >= params.userSlippagePct
      })
    )
  })

  it("is monotone non-decreasing in barterShortfallPct (up to the cap)", () => {
    // Larger shortfall → floor rises or stays the same. Never drops.
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        (userSlippagePct, shortfallA, shortfallB) => {
          const [small, big] = shortfallA <= shortfallB
            ? [shortfallA, shortfallB]
            : [shortfallB, shortfallA]
          const out1 = computeAppliedSlippagePct({
            userSlippagePct,
            barterShortfallPct: small,
            maxSlippagePct: 2,
          })
          const out2 = computeAppliedSlippagePct({
            userSlippagePct,
            barterShortfallPct: big,
            maxSlippagePct: 2,
          })
          return out2 >= out1
        }
      )
    )
  })

  it("shortfall=0 collapses to max(userSlippage, 0), capped at max", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50, noNaN: true }),
        fc.double({ min: 0.1, max: 50, noNaN: true }),
        (userSlippagePct, maxSlippagePct) => {
          const out = computeAppliedSlippagePct({
            userSlippagePct,
            barterShortfallPct: 0,
            maxSlippagePct,
          })
          const expected = Math.min(maxSlippagePct, Math.max(userSlippagePct, 0))
          return out === expected
        }
      )
    )
  })

  it("buffer is the default 0.5% when unspecified", () => {
    // Soft guard — a silent buffer change would silently shift every
    // minAmountOut in prod. Worth a test.
    const withDefault = computeAppliedSlippagePct({
      userSlippagePct: 0,
      barterShortfallPct: 1,
    })
    const withExplicit = computeAppliedSlippagePct({
      userSlippagePct: 0,
      barterShortfallPct: 1,
      barterBufferPct: DEFAULT_BARTER_BUFFER_PCT,
    })
    expect(withDefault).toBe(withExplicit)
    expect(DEFAULT_BARTER_BUFFER_PCT).toBe(0.5)
  })

  it("is total — no input combination throws", () => {
    fc.assert(
      fc.property(
        fc.double(),
        fc.double(),
        fc.option(fc.double({ min: 0.01, max: 100, noNaN: true })),
        fc.option(fc.double({ min: 0, max: 10, noNaN: true })),
        (userSlippagePct, barterShortfallPct, maxSlippagePct, barterBufferPct) => {
          computeAppliedSlippagePct({
            userSlippagePct,
            barterShortfallPct,
            maxSlippagePct: maxSlippagePct ?? undefined,
            barterBufferPct: barterBufferPct ?? undefined,
          })
          return true
        }
      )
    )
  })
})

// ─── computeAppliedSlippageBps — bridges to the slippage module ──────────────

describe("computeAppliedSlippageBps", () => {
  it("returns a bigint ≤ slippageBpsFromPercent(maxSlippagePct)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (userSlippagePct, barterShortfallPct) => {
          const bps = computeAppliedSlippageBps({
            userSlippagePct,
            barterShortfallPct,
          })
          return typeof bps === "bigint" && bps >= 0n && bps <= 5_000n
        }
      )
    )
  })

  it("composes with computeSlippageLimit to produce a valid on-chain floor", () => {
    // End-to-end invariant: the bps we emit, fed into the contract-side
    // slippage math, ALWAYS produces a floor that's ≤ the input amount
    // (exactIn semantics). This is the whole point of this module — if
    // this ever fails, settlement reverts.
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: (1n << 96n) - 1n }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        (amountOut, userSlippagePct, barterShortfallPct) => {
          const bps = computeAppliedSlippageBps({
            userSlippagePct,
            barterShortfallPct,
            maxSlippagePct: 2,
          })
          const limit = computeSlippageLimit(amountOut, bps, "exactIn")
          return limit <= amountOut && limit >= 0n
        }
      )
    )
  })

  it("honors the shared SLIPPAGE_MAX_PCT ceiling when no explicit max is passed", () => {
    // If the caller didn't override `maxSlippagePct`, the helper defers to
    // the shared module constant. Future refactors that decouple the two
    // would drift silently without this pin.
    const largeUser = computeAppliedSlippageBps({
      userSlippagePct: 10_000,
      barterShortfallPct: 0,
    })
    const expectedMaxBps = BigInt(Math.floor(SLIPPAGE_MAX_PCT * 100))
    expect(largeUser).toBe(expectedMaxBps)
  })
})
