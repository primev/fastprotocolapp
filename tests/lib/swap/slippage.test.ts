import { describe, it, expect } from "vitest"
import fc from "fast-check"
import {
  validateSlippage,
  slippageBpsFromPercent,
  computeSlippageLimit,
  BPS_DENOM,
  SLIPPAGE_MAX_PCT,
  SLIPPAGE_DEFAULT_PCT,
} from "@/lib/swap/slippage"
import { bigUint128, slippageBps } from "../../utils/arbitraries"

// Slippage math is the single most safety-critical piece of pure code in
// this app. The value we emit here is the `minAmountOut` / `maxAmountIn`
// passed to the settlement contract — a regression is a direct user loss.
//
// Strategy:
//   - Example tests pin named boundary cases (zero slippage, 50% cap, etc.).
//   - Property tests assert the algebraic invariants hold for every
//     (amount, bps) combination in the realistic range. fast-check samples
//     ~100 pairs per property by default, which is enough to catch any
//     off-by-one, overflow, or sign-flip regression.

// ─── validateSlippage ────────────────────────────────────────────────────────

describe("validateSlippage — examples", () => {
  it("defaults empty/invalid/negative to 0.5%", () => {
    expect(validateSlippage("")).toBe(SLIPPAGE_DEFAULT_PCT)
    expect(validateSlippage("abc")).toBe(SLIPPAGE_DEFAULT_PCT)
    expect(validateSlippage("-1")).toBe(SLIPPAGE_DEFAULT_PCT)
  })

  it("caps at 50%", () => {
    expect(validateSlippage("100")).toBe(SLIPPAGE_MAX_PCT)
    expect(validateSlippage("50.1")).toBe(SLIPPAGE_MAX_PCT)
  })

  it("passes through in-range values", () => {
    expect(validateSlippage("0.1")).toBe(0.1)
    expect(validateSlippage("1.0")).toBe(1.0)
    expect(validateSlippage("25")).toBe(25)
  })
})

describe("validateSlippage — properties", () => {
  it("output is always within [0, SLIPPAGE_MAX_PCT]", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = validateSlippage(s)
        return out >= 0 && out <= SLIPPAGE_MAX_PCT
      })
    )
  })

  it("is idempotent under String() → parse round-trip", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const once = validateSlippage(s)
        const twice = validateSlippage(String(once))
        return once === twice
      })
    )
  })
})

// ─── slippageBpsFromPercent ──────────────────────────────────────────────────

describe("slippageBpsFromPercent — properties", () => {
  it("output is always a bigint in [0, 5000]", () => {
    // 5000 bps = 50%, matching SLIPPAGE_MAX_PCT. The helper clamps before
    // multiplying so out-of-range percents don't produce out-of-range bps.
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (pct) => {
        const out = slippageBpsFromPercent(pct)
        return typeof out === "bigint" && out >= 0n && out <= 5_000n
      })
    )
  })

  it("is monotone non-decreasing in the percent argument", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (a, b) => {
          if (a <= b) return slippageBpsFromPercent(a) <= slippageBpsFromPercent(b)
          return slippageBpsFromPercent(a) >= slippageBpsFromPercent(b)
        }
      )
    )
  })

  it("0% → 0 bps; 50% → 5000 bps", () => {
    expect(slippageBpsFromPercent(0)).toBe(0n)
    expect(slippageBpsFromPercent(50)).toBe(5_000n)
  })
})

// ─── computeSlippageLimit ────────────────────────────────────────────────────

describe("computeSlippageLimit — examples", () => {
  it("exactIn with 0% slippage returns the same amount", () => {
    expect(computeSlippageLimit(1_000_000n, 0n, "exactIn")).toBe(1_000_000n)
  })

  it("exactOut with 0% slippage returns the same amount", () => {
    expect(computeSlippageLimit(1_000_000n, 0n, "exactOut")).toBe(1_000_000n)
  })

  it("exactIn 1% on 1e18 yields 0.99e18", () => {
    const amount = 10n ** 18n
    const bps = 100n // 1%
    expect(computeSlippageLimit(amount, bps, "exactIn")).toBe((amount * 9_900n) / 10_000n)
  })

  it("exactOut 1% on 1e18 yields 1.01e18", () => {
    const amount = 10n ** 18n
    const bps = 100n
    expect(computeSlippageLimit(amount, bps, "exactOut")).toBe((amount * 10_100n) / 10_000n)
  })
})

describe("computeSlippageLimit — invariants", () => {
  it("exactIn limit is always ≤ the input amount (minimum-received floor)", () => {
    // Contract-side safety: minAmountOut must never exceed amountOut.
    // A regression here reverts the tx on-chain; defend at the ts boundary.
    fc.assert(
      fc.property(bigUint128(), slippageBps(), (amount, bps) => {
        const limit = computeSlippageLimit(amount, BigInt(bps), "exactIn")
        return limit <= amount
      })
    )
  })

  it("exactOut limit is always ≥ the input amount (maximum-paid ceiling)", () => {
    fc.assert(
      fc.property(bigUint128(), slippageBps(), (amount, bps) => {
        const limit = computeSlippageLimit(amount, BigInt(bps), "exactOut")
        return limit >= amount
      })
    )
  })

  it("is non-negative for all inputs", () => {
    // Wei values can't be negative. A negative limit sent to the contract
    // would underflow uint256 and revert — we prove the math never produces one.
    fc.assert(
      fc.property(
        bigUint128(),
        slippageBps(),
        fc.constantFrom("exactIn" as const, "exactOut" as const),
        (amount, bps, dir) => {
          return computeSlippageLimit(amount, BigInt(bps), dir) >= 0n
        }
      )
    )
  })

  it("is monotone in bps for exactIn — more slippage → lower floor", () => {
    // Intuition: allowing more slippage relaxes the minimum received.
    fc.assert(
      fc.property(
        bigUint128(),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (amount, bpsA, bpsB) => {
          const a = computeSlippageLimit(amount, BigInt(bpsA), "exactIn")
          const b = computeSlippageLimit(amount, BigInt(bpsB), "exactIn")
          if (bpsA <= bpsB) return a >= b
          return a <= b
        }
      )
    )
  })

  it("is monotone in bps for exactOut — more slippage → higher ceiling", () => {
    fc.assert(
      fc.property(
        bigUint128(),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (amount, bpsA, bpsB) => {
          const a = computeSlippageLimit(amount, BigInt(bpsA), "exactOut")
          const b = computeSlippageLimit(amount, BigInt(bpsB), "exactOut")
          if (bpsA <= bpsB) return a <= b
          return a >= b
        }
      )
    )
  })

  it("is scale-invariant up to integer-division rounding", () => {
    // Doubling the amount should ~double the limit. "Approximately" because
    // integer bigint division drops remainders; the diff from the ideal
    // double is bounded by the BPS_DENOM itself.
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: (1n << 80n) - 1n }),
        slippageBps(),
        fc.constantFrom("exactIn" as const, "exactOut" as const),
        (amount, bps, dir) => {
          const single = computeSlippageLimit(amount, BigInt(bps), dir)
          const doubled = computeSlippageLimit(amount * 2n, BigInt(bps), dir)
          // doubled should be within BPS_DENOM of (single * 2)
          const ideal = single * 2n
          const diff = doubled > ideal ? doubled - ideal : ideal - doubled
          return diff <= BPS_DENOM
        }
      )
    )
  })

  it("100% slippage collapses exactIn to zero", () => {
    // Sanity corner: if the user accepts 100% slippage, the floor is 0.
    // (Our validator caps at 50%, but the math still has to handle the
    // boundary because tests and future configs may push it.)
    fc.assert(
      fc.property(bigUint128(), (amount) => {
        return computeSlippageLimit(amount, 10_000n, "exactIn") === 0n
      })
    )
  })
})
