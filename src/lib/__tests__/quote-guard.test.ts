import { describe, it, expect } from "vitest"
import { isQuoteGuardTriggered, computeQuoteGuardFloor } from "../quote-guard"

describe("isQuoteGuardTriggered", () => {
  it("fires on the $47 DAI→WBTC case (206% divergence at 25% threshold)", () => {
    // Reproduces tx 0x2f19...f507: 67 DAI → WBTC.
    // Uniswap single-hop returned 31220 sats; Barter multihop filled 95445.
    const uniswap = 31220n
    const barter = 95445n
    expect(isQuoteGuardTriggered(uniswap, barter, 25)).toBe(true)
  })

  it("does not fire on a routine major pair where Barter beats Uniswap by 0.5%", () => {
    // ETH → USDC, typical day: Barter nudges slightly better via multihop,
    // but well below the 25% threshold — treasury keeps the routine surplus.
    const uniswap = 1_000_000_000n
    const barter = 1_005_000_000n
    expect(isQuoteGuardTriggered(uniswap, barter, 25)).toBe(false)
  })

  it("fires exactly when Barter clears the threshold boundary", () => {
    const uniswap = 10_000n
    // Threshold 25% → trigger boundary is 12500. 12501 fires, 12500 does not.
    expect(isQuoteGuardTriggered(uniswap, 12_500n, 25)).toBe(false)
    expect(isQuoteGuardTriggered(uniswap, 12_501n, 25)).toBe(true)
  })

  it("does not fire when Barter is smaller than Uniswap (amountTooSmall territory)", () => {
    // This direction is handled upstream by `amountTooSmall` blocking the swap —
    // the guard should stay out of it.
    expect(isQuoteGuardTriggered(100_000n, 90_000n, 25)).toBe(false)
  })

  it("does not fire when either amount is missing or zero", () => {
    expect(isQuoteGuardTriggered(undefined, 100n, 25)).toBe(false)
    expect(isQuoteGuardTriggered(100n, undefined, 25)).toBe(false)
    expect(isQuoteGuardTriggered(0n, 100n, 25)).toBe(false)
    expect(isQuoteGuardTriggered(100n, 0n, 25)).toBe(false)
  })

  it("fails closed when the threshold is misconfigured", () => {
    // A zero, negative, or NaN threshold should never trigger the guard —
    // we want a bad Edge Config value to produce current behavior, not open
    // the floodgates to Barter-as-anchor on every swap.
    expect(isQuoteGuardTriggered(100n, 1_000_000n, 0)).toBe(false)
    expect(isQuoteGuardTriggered(100n, 1_000_000n, -5)).toBe(false)
    expect(isQuoteGuardTriggered(100n, 1_000_000n, NaN)).toBe(false)
    expect(isQuoteGuardTriggered(100n, 1_000_000n, Infinity)).toBe(false)
  })

  it("supports fractional thresholds via bps math", () => {
    // Threshold 12.5% on a Uniswap quote of 10_000 → trigger boundary 11250.
    expect(isQuoteGuardTriggered(10_000n, 11_250n, 12.5)).toBe(false)
    expect(isQuoteGuardTriggered(10_000n, 11_251n, 12.5)).toBe(true)
  })

  it("tight threshold (1%) fires on a small Barter edge — useful for local force-trigger", () => {
    // Used when testing: drop threshold to 1, any routine 1%+ Barter advantage fires.
    expect(isQuoteGuardTriggered(1_000_000n, 1_011_000n, 1)).toBe(true)
    expect(isQuoteGuardTriggered(1_000_000n, 1_009_000n, 1)).toBe(false)
  })
})

describe("computeQuoteGuardFloor", () => {
  it("applies the treasury margin as a multiplicative discount", () => {
    // 1.5% margin on 10_000 → floor = 9850.
    expect(computeQuoteGuardFloor(10_000n, 1.5)).toBe(9_850n)
  })

  it("matches the $47 tx fix: 95445 × 0.985 → user receives 94013, treasury ~1432", () => {
    const barter = 95_445n
    const floor = computeQuoteGuardFloor(barter, 1.5)
    expect(floor).toBe(94_013n)
    expect(barter - floor).toBe(1_432n) // treasury margin
  })

  it("returns the full Barter amount when margin is zero", () => {
    expect(computeQuoteGuardFloor(10_000n, 0)).toBe(10_000n)
  })

  it("clamps negative margins to zero (cannot exceed Barter output)", () => {
    // A negative margin would sign a userAmtOut greater than the actual Barter fill —
    // the contract would revert on InsufficientOut. Guard against that upstream.
    expect(computeQuoteGuardFloor(10_000n, -5)).toBe(10_000n)
  })

  it("coerces NaN margin to zero rather than producing nonsense output", () => {
    expect(computeQuoteGuardFloor(10_000n, NaN)).toBe(10_000n)
  })

  it("supports fractional margins with basis-point precision", () => {
    // 0.75% on 100_000 → 99_250.
    expect(computeQuoteGuardFloor(100_000n, 0.75)).toBe(99_250n)
  })

  it("preserves precision on small values (WBTC-scale sats)", () => {
    // Tiny bigint values must not round to zero — 1 sat × 0.985 rounds down to 0,
    // which is expected behavior (BigInt division truncates). Documented here so a
    // future change that tries to "fix" the rounding knows it is intentional.
    expect(computeQuoteGuardFloor(1n, 1.5)).toBe(0n)
    expect(computeQuoteGuardFloor(100n, 1.5)).toBe(98n) // floor(100 × 9850 / 10000) = 98
  })
})
