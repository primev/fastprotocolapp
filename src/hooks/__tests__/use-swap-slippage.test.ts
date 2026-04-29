import { describe, it, expect } from "vitest"
import {
  AUTO_BASE_ETH,
  AUTO_BASE_PERMIT,
  AUTO_BUMP_BUFFER_PCT,
  SLIPPAGE_MAX,
  SLIPPAGE_STEP,
  computeAutoBumpValue,
  computeAutoSlippage,
  formatSlippage,
  finalizeSlippage,
  sanitizeInput,
} from "../use-swap-slippage"

describe("computeAutoBumpValue", () => {
  it("returns just the buffer when shortfall is zero", () => {
    expect(computeAutoBumpValue(0)).toBeCloseTo(AUTO_BUMP_BUFFER_PCT, 9)
  })

  it("is linear in shortfall (no step rounding before the cap)", () => {
    // The pre-cap pipeline used to ceil-round shortfall to 0.1% then add the
    // buffer, which produced the artifact where any positive shortfall pushed
    // auto one step above baseline. Linear: shortfall + buffer.
    expect(computeAutoBumpValue(0.31)).toBeCloseTo(0.31 + AUTO_BUMP_BUFFER_PCT, 9)
    expect(computeAutoBumpValue(0.5)).toBeCloseTo(0.5 + AUTO_BUMP_BUFFER_PCT, 9)
    expect(computeAutoBumpValue(0.001)).toBeCloseTo(0.001 + AUTO_BUMP_BUFFER_PCT, 9)
  })

  it("clamps at SLIPPAGE_MAX so auto can ramp all the way up if shortfall demands", () => {
    expect(computeAutoBumpValue(45)).toBeCloseTo(45 + AUTO_BUMP_BUFFER_PCT, 9)
    expect(computeAutoBumpValue(50)).toBe(SLIPPAGE_MAX)
    expect(computeAutoBumpValue(75)).toBe(SLIPPAGE_MAX)
    expect(computeAutoBumpValue(1_000)).toBe(SLIPPAGE_MAX)
  })

  it("is monotonic non-decreasing in shortfall", () => {
    let prev = -Infinity
    for (let s = 0; s < SLIPPAGE_MAX; s += 0.1) {
      const v = computeAutoBumpValue(s)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })
})

describe("computeAutoSlippage", () => {
  it("uses ETH-path autoBase floor (0.5%) when not permit", () => {
    expect(computeAutoSlippage(0, false).slippage).toBe(
      formatSlippage(Math.max(AUTO_BASE_ETH, AUTO_BUMP_BUFFER_PCT))
    )
  })

  it("uses permit-path autoBase floor (1%) when permit", () => {
    expect(computeAutoSlippage(0, true).slippage).toBe(
      formatSlippage(Math.max(AUTO_BASE_PERMIT, AUTO_BUMP_BUFFER_PCT))
    )
  })

  it("does NOT mark bumped at the default baseline", () => {
    expect(computeAutoSlippage(0, false).bumped).toBe(false)
    expect(computeAutoSlippage(0, true).bumped).toBe(false)
  })

  it("marks bumped once shortfall pushes above the baseline", () => {
    // baseline = max(autoBase, buffer=1.0). Any positive shortfall above 0
    // produces ceil(s/0.1)*0.1 + 1.0 > 1.0.
    expect(computeAutoSlippage(0.1, false).bumped).toBe(true)
    expect(computeAutoSlippage(2.5, false).bumped).toBe(true)
  })

  it("clamps slippage at SLIPPAGE_MAX even on extreme shortfall", () => {
    const out = computeAutoSlippage(80, false)
    expect(parseFloat(out.slippage)).toBeLessThanOrEqual(SLIPPAGE_MAX)
  })
})

describe("formatSlippage", () => {
  it("returns plain integer when whole", () => {
    expect(formatSlippage(5)).toBe("5")
    expect(formatSlippage(0)).toBe("0")
    expect(formatSlippage(50)).toBe("50")
  })

  it("returns 1-decimal for fractional", () => {
    expect(formatSlippage(0.5)).toBe("0.5")
    expect(formatSlippage(1.7)).toBe("1.7")
    expect(formatSlippage(49.9)).toBe("49.9")
  })
})

describe("finalizeSlippage", () => {
  it("rounds to nearest 0.1% step", () => {
    expect(finalizeSlippage("1.23", 0.5)).toBe("1.2")
    expect(finalizeSlippage("1.27", 0.5)).toBe("1.3")
  })

  it("clamps below the min to the min", () => {
    expect(finalizeSlippage("0.1", 0.5)).toBe("0.5")
    expect(finalizeSlippage("0", 1)).toBe("1")
  })

  it("clamps above SLIPPAGE_MAX to SLIPPAGE_MAX", () => {
    expect(finalizeSlippage("100", 0.5)).toBe(formatSlippage(SLIPPAGE_MAX))
    expect(finalizeSlippage("50.7", 0.5)).toBe(formatSlippage(SLIPPAGE_MAX))
  })

  it("falls back to min when input is unparseable", () => {
    expect(finalizeSlippage("", 0.5)).toBe("0.5")
    expect(finalizeSlippage("abc", 0.5)).toBe("0.5")
    expect(finalizeSlippage(".", 0.5)).toBe("0.5")
  })
})

describe("sanitizeInput", () => {
  it("strips non-numeric characters", () => {
    expect(sanitizeInput("abc1.5xyz")).toBe("1.5")
    expect(sanitizeInput("1,5")).toBe("15")
  })

  it("collapses multiple dots to one", () => {
    expect(sanitizeInput("1.5.7")).toBe("1.57")
    expect(sanitizeInput("..3")).toBe(".3")
  })

  it("preserves a single leading dot", () => {
    expect(sanitizeInput(".5")).toBe(".5")
  })
})

describe("auto-slippage fuzz invariants", () => {
  // Deterministic PRNG so failures are reproducible.
  function mulberry32(seed: number) {
    let state = seed >>> 0
    return () => {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  it("auto-slippage is always within [autoBase, SLIPPAGE_MAX]", () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 10_000; i++) {
      const shortfall = rng() * 60 // 0..60% shortfall
      const isPermit = rng() < 0.5
      const out = computeAutoSlippage(shortfall, isPermit)
      const v = parseFloat(out.slippage)
      const expectedFloor = isPermit ? AUTO_BASE_PERMIT : AUTO_BASE_ETH
      expect(v).toBeGreaterThanOrEqual(expectedFloor - 1e-9)
      expect(v).toBeLessThanOrEqual(SLIPPAGE_MAX + 1e-9)
    }
  })

  it("auto-slippage covers the shortfall when feasible (slippage ≥ shortfall, up to the SLIPPAGE_MAX rail)", () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 10_000; i++) {
      // Stay within range where adding the buffer doesn't run into SLIPPAGE_MAX.
      const shortfall = rng() * (SLIPPAGE_MAX - AUTO_BUMP_BUFFER_PCT - 0.5)
      const isPermit = rng() < 0.5
      const out = computeAutoSlippage(shortfall, isPermit)
      const v = parseFloat(out.slippage)
      // Auto must always sit at or above the observed shortfall, otherwise
      // the swap reverts as amount-too-small.
      expect(v).toBeGreaterThanOrEqual(shortfall - 1e-9)
    }
  })

  it("auto-slippage is monotonic non-decreasing in shortfall", () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 1_000; i++) {
      const isPermit = rng() < 0.5
      const a = rng() * 40
      const b = a + rng() * 5
      const va = parseFloat(computeAutoSlippage(a, isPermit).slippage)
      const vb = parseFloat(computeAutoSlippage(b, isPermit).slippage)
      expect(vb).toBeGreaterThanOrEqual(va - 1e-9)
    }
  })

  it("finalizeSlippage output is always a valid step-aligned value in range", () => {
    const rng = mulberry32(2026)
    for (let i = 0; i < 10_000; i++) {
      const raw = rng() * 70 - 5 // -5..65
      const min = rng() < 0.5 ? AUTO_BASE_ETH : AUTO_BASE_PERMIT
      const out = finalizeSlippage(raw.toString(), min)
      const v = parseFloat(out)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(min - 1e-9)
      expect(v).toBeLessThanOrEqual(SLIPPAGE_MAX + 1e-9)
      // Should align to the 0.1% step.
      const stepUnits = Math.round(v / SLIPPAGE_STEP)
      expect(Math.abs(v - stepUnits * SLIPPAGE_STEP)).toBeLessThan(1e-9)
    }
  })
})
