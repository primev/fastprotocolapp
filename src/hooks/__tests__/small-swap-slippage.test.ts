/**
 * Characterization + fuzz tests for the auto-slippage behavior at small swap
 * sizes. Motivated by the observation that toggling between 0.01 and 0.02 ETH
 * (and similar boundary cases) produces a slippage value that "feels random" —
 * sometimes ~8.8%, sometimes 50%, sometimes 1%.
 *
 * These tests do NOT assert that the current behavior is *correct*; they
 * document what the pipeline actually does so we have a baseline before
 * deciding which knobs to turn. If the documented behavior changes
 * intentionally, update these tests in the same commit.
 *
 * The full pipeline simulated here:
 *
 *   uniswapAmtOut          ← uniswap's quoted output for the user's amount
 *   barterPreGasAmtOut     ← barter's pre-gas routed output
 *   barterPostGasAmtOut    ← barter's post-gas output (pre-gas − gas)
 *   shortfall%             ← (uniswapAmtOut − barterPostGasAmtOut) / uniswap × 100
 *
 *   if |shortfall| > 90 → discard (sanity guard in use-barter-validation)
 *   else clamped       ← max(0, shortfall)
 *   ratchet            ← max(prevRatchet, clamped)  [resets on amount/pair change]
 *   autoSlippage       ← computeAutoSlippage(ratchet, isPermit)
 *
 * The ratchet is the load-bearing piece for the user's "all over the board"
 * complaint: it ONLY moves up within a session, so a single high observation
 * (or a stale stale-quote artifact) sticks until the user changes amount or
 * pair.
 */

import { describe, it, expect } from "vitest"
import {
  AUTO_BASE_ETH,
  AUTO_BASE_PERMIT,
  AUTO_BUMP_BUFFER_PCT,
  SLIPPAGE_MAX,
  computeAutoSlippage,
} from "../use-swap-slippage"

// The barter validator's sanity threshold (lowered from 90 → 50). Stale-quote
// or gas-eats-output observations above this are surfaced via amountTooSmall
// instead of polluting the ratchet.
const SANITY_GATE_PCT = 50

// ──────────────────────────────────────────────────────────────────────────
// Pipeline simulation — pure function mirror of the live data flow
// ──────────────────────────────────────────────────────────────────────────

interface SimulatedAuto {
  /** Observed shortfall this tick (0 if discarded by sanity gate). */
  shortfallPct: number
  /** Whether the sanity gate dropped the observation. */
  sanityGated: boolean
  /** New ratcheted shortfall after this tick. */
  newRatchet: number
  /** Auto slippage produced by computeAutoSlippage(ratchet, isPermit). */
  slippagePct: number
  /** Whether auto reports itself as bumped above baseline. */
  bumped: boolean
}

/**
 * Mirror of the validation → ratchet → auto-slippage sequence that runs across
 * use-barter-validation, use-swap-form, and use-swap-slippage.
 */
function simulateAuto(args: {
  uniswapAmtOut: number
  barterPreGas: number
  gasCost: number
  isPermit: boolean
  prevRatchet: number
}): SimulatedAuto {
  const { uniswapAmtOut, barterPreGas, gasCost, isPermit, prevRatchet } = args

  const barterPostGas = barterPreGas - gasCost
  const rawShortfall =
    uniswapAmtOut > 0 ? ((uniswapAmtOut - barterPostGas) / uniswapAmtOut) * 100 : 0

  const sanityGated = Math.abs(rawShortfall) > SANITY_GATE_PCT
  const observedShortfall = sanityGated ? 0 : Math.max(0, rawShortfall)

  // The ratchet is unaffected by sanity-gated observations (they're discarded
  // before reaching the ratchet effect). prevRatchet carries through unchanged.
  const newRatchet = sanityGated ? prevRatchet : Math.max(prevRatchet, observedShortfall)

  const auto = computeAutoSlippage(newRatchet, isPermit)
  return {
    shortfallPct: observedShortfall,
    sanityGated,
    newRatchet,
    slippagePct: parseFloat(auto.slippage),
    bumped: auto.bumped,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Deterministic PRNG so failures are reproducible
// ──────────────────────────────────────────────────────────────────────────
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

// Realistic gas cost defaults — match miles-math.test.ts so cross-file numbers
// can be eyeballed against each other.
const PERMIT_GAS_COST_ETH = 2.7e-4 // baseFee 1.5 gwei × ~180k gasUsed
const ETH_PATH_GAS_COST_ETH = 2.7e-5 // priorityFee 0.06 gwei × ~450k

// ──────────────────────────────────────────────────────────────────────────
// Reproducing the user's report: 0.01 ETH ⇄ 0.02 ETH toggle
// ──────────────────────────────────────────────────────────────────────────
describe("small-swap reproduction: 0.01 ↔ 0.02 ETH toggle", () => {
  // We use barter ≈ uniswap (1:1 pre-gas) so the ONLY shortfall driver is gas
  // overhead. This isolates the small-swap math from routing-divergence noise.
  const PERMIT = true

  it("0.01 ETH permit swap with realistic gas: shortfall is meaningful, auto bumps", () => {
    const eth = 0.01
    const result = simulateAuto({
      uniswapAmtOut: eth,
      barterPreGas: eth, // barter matches uniswap pre-gas
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: PERMIT,
      prevRatchet: 0,
    })
    // shortfall = gas/output × 100 = 2.7e-4 / 0.01 × 100 = 2.7%
    expect(result.shortfallPct).toBeCloseTo(2.7, 1)
    // Linear: shortfall + buffer = 2.7 + 1.0 = 3.7% (formatted to 1 decimal).
    expect(result.slippagePct).toBeCloseTo(3.7, 9)
    expect(result.bumped).toBe(true)
  })

  it("0.02 ETH permit swap halves the shortfall, auto stays close to baseline", () => {
    const eth = 0.02
    const result = simulateAuto({
      uniswapAmtOut: eth,
      barterPreGas: eth,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: PERMIT,
      prevRatchet: 0,
    })
    // shortfall = 2.7e-4 / 0.02 × 100 = 1.35%
    expect(result.shortfallPct).toBeCloseTo(1.35, 1)
    // Linear: 1.35 + 1.0 = 2.35. JS toFixed(1) rounds 2.35 to "2.3" (because
    // the float representation is 2.3499999…). The exact display value is
    // less important than the magnitude — well below the 5% cap.
    expect(result.slippagePct).toBeLessThan(2.5)
    expect(result.slippagePct).toBeGreaterThan(2.2)
  })

  it("RATCHET LOCK-IN: starting at 0.01 then toggling to 0.02 keeps the higher slippage", () => {
    // First tick: 0.01 raises ratchet to ~2.7%.
    const tick1 = simulateAuto({
      uniswapAmtOut: 0.01,
      barterPreGas: 0.01,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: PERMIT,
      prevRatchet: 0,
    })
    // Second tick: 0.02 produces a smaller observed shortfall (~1.35%).
    // BUT the ratchet only moves UP within a session — so until amount changes
    // reset it, the auto value sticks at the 0.01 high-water mark.
    //
    // NOTE: this test simulates a hypothetical "bug path" where the ratchet is
    // NOT reset between ticks. In production the ratchet IS reset on amount
    // change (use-swap-form.ts:348-350). This test exists to characterize
    // what would happen if that reset ever regressed.
    const tick2WithoutReset = simulateAuto({
      uniswapAmtOut: 0.02,
      barterPreGas: 0.02,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: PERMIT,
      prevRatchet: tick1.newRatchet,
    })
    expect(tick2WithoutReset.slippagePct).toBeCloseTo(tick1.slippagePct, 9)
    expect(tick2WithoutReset.newRatchet).toBeCloseTo(tick1.newRatchet, 9)
  })

  it("RATCHET RESET: toggling amount reset → 0.02 produces its own (lower) auto value", () => {
    // Production path: amount-change effect resets ratchet to 0.
    const tick1 = simulateAuto({
      uniswapAmtOut: 0.01,
      barterPreGas: 0.01,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: PERMIT,
      prevRatchet: 0,
    })
    const tick2WithReset = simulateAuto({
      uniswapAmtOut: 0.02,
      barterPreGas: 0.02,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: PERMIT,
      prevRatchet: 0, // ← reset
    })
    expect(tick2WithReset.slippagePct).toBeLessThan(tick1.slippagePct)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Where could 50% come from?
// ──────────────────────────────────────────────────────────────────────────
describe("auto-slippage ramp behavior (post-fix)", () => {
  it("auto ramps to shortfall + buffer, signalling the real cost of execution", () => {
    const r = simulateAuto({
      uniswapAmtOut: 1,
      barterPreGas: 1,
      gasCost: 0.045, // 4.5% gas-eat
      isPermit: true,
      prevRatchet: 0,
    })
    expect(r.sanityGated).toBe(false)
    expect(r.shortfallPct).toBeCloseTo(4.5, 1)
    // Linear ramp: 4.5 + 1.0 = 5.5%. User sees the real cost.
    expect(r.slippagePct).toBeCloseTo(5.5, 9)
  })

  it("auto ramps freely up to SLIPPAGE_MAX when shortfall demands it (no premature cap)", () => {
    // Just under the new sanity gate. Shortfall is real and observable.
    const r = simulateAuto({
      uniswapAmtOut: 1,
      barterPreGas: 1,
      gasCost: 0.45, // 45% gas-eat
      isPermit: true,
      prevRatchet: 0,
    })
    expect(r.sanityGated).toBe(false)
    // 45 + 1.0 = 46% — auto reports the actual slippage required.
    expect(r.slippagePct).toBeCloseTo(46, 9)
  })

  it("auto rails at SLIPPAGE_MAX once shortfall + buffer would exceed it", () => {
    // Push shortfall to ~49% (under the 50% sanity gate).
    const ratcheted = simulateAuto({
      uniswapAmtOut: 0.001,
      barterPreGas: 0.001,
      gasCost: 0.001 * 0.495, // 49.5% gas-eat
      isPermit: true,
      prevRatchet: 0,
    }).newRatchet
    expect(ratcheted).toBeGreaterThan(48)

    // Next tick — ratchet still active.
    const next = simulateAuto({
      uniswapAmtOut: 0.05,
      barterPreGas: 0.05,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: true,
      prevRatchet: ratcheted,
    })
    // 49.5 + 1.0 = 50.5 → clamped to SLIPPAGE_MAX.
    expect(next.slippagePct).toBe(SLIPPAGE_MAX)
  })

  it("sanity-gated observations DO NOT raise the ratchet (>50% shortfall is dropped)", () => {
    // Pathological case: gas exceeds output → shortfall > 100%. Sanity gate
    // discards it; ratchet stays put. (Threshold lowered 90 → 50 in this fix.)
    const r = simulateAuto({
      uniswapAmtOut: 0.0001,
      barterPreGas: 0.0001,
      gasCost: 0.001, // 10× the output
      isPermit: true,
      prevRatchet: 3,
    })
    expect(r.sanityGated).toBe(true)
    expect(r.newRatchet).toBe(3)
    // Auto reflects the prior ratchet (linear): 3 + 1 = 4%
    expect(r.slippagePct).toBeCloseTo(4.0, 9)
  })

  it("sanity gate now fires at 51% (was 91%)", () => {
    // Just under the new gate.
    const under = simulateAuto({
      uniswapAmtOut: 1,
      barterPreGas: 1,
      gasCost: 0.49,
      isPermit: true,
      prevRatchet: 0,
    })
    expect(under.sanityGated).toBe(false)

    // Just over the new gate.
    const over = simulateAuto({
      uniswapAmtOut: 1,
      barterPreGas: 1,
      gasCost: 0.51,
      isPermit: true,
      prevRatchet: 0,
    })
    expect(over.sanityGated).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Continuous sweep — characterize the slippage curve as swap size shrinks
// ──────────────────────────────────────────────────────────────────────────
describe("sweep: slippage as a function of swap size (fixed gas, fresh ratchet)", () => {
  it("auto slippage decreases monotonically as swap size grows from 0.001 to 1 ETH", () => {
    // Fresh ratchet each tick — simulates the production amount-change reset.
    const sizes: number[] = []
    for (let eth = 0.001; eth <= 1.0; eth += 0.001) sizes.push(eth)

    let prev = Infinity
    let strictDecreaseCount = 0
    for (const eth of sizes) {
      const r = simulateAuto({
        uniswapAmtOut: eth,
        barterPreGas: eth,
        gasCost: PERMIT_GAS_COST_ETH,
        isPermit: true,
        prevRatchet: 0,
      })
      // Slippage is non-increasing in swap size.
      expect(r.slippagePct).toBeLessThanOrEqual(prev + 1e-9)
      if (r.slippagePct < prev - 1e-9) strictDecreaseCount++
      prev = r.slippagePct
    }
    // Must have actually moved across at least a handful of step boundaries.
    expect(strictDecreaseCount).toBeGreaterThan(20)
  })

  it("auto slippage at very small sizes: gate fires above 50% shortfall, otherwise ramps", () => {
    // 5e-4 ETH × default permit gas (2.7e-4 ETH) → 54% shortfall.
    // Above the new 50% sanity gate → observation discarded, auto stays at
    // baseline and amountTooSmall fires upstream via sanityGated.
    const r = simulateAuto({
      uniswapAmtOut: 5e-4,
      barterPreGas: 5e-4,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: true,
      prevRatchet: 0,
    })
    expect(r.sanityGated).toBe(true)
    const baseline = Math.max(AUTO_BASE_PERMIT, AUTO_BUMP_BUFFER_PCT)
    expect(r.slippagePct).toBeCloseTo(baseline, 9)
  })

  it("just below the gate, auto ramps to the actual shortfall + buffer (transparent cost)", () => {
    // 6e-4 ETH × 2.7e-4 gas → 45% shortfall, well under the gate.
    const r = simulateAuto({
      uniswapAmtOut: 6e-4,
      barterPreGas: 6e-4,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: true,
      prevRatchet: 0,
    })
    expect(r.sanityGated).toBe(false)
    expect(r.shortfallPct).toBeCloseTo(45, 0)
    expect(r.slippagePct).toBeCloseTo(46, 9) // shortfall + buffer
  })

  it("FIXED (Problem 1): tiny positive shortfall yields auto at exact baseline (linear, not stair-stepped)", () => {
    // 1 ETH × permit gas → shortfall ≈ 0.027%. Linear: 0.027 + 1.0 = 1.027.
    // formatSlippage rounds to 1 decimal → "1" → 1.0. Pre-fix: stair-stepped
    // to 1.1 because shortfall was step-rounded UP before adding the buffer.
    const r = simulateAuto({
      uniswapAmtOut: 1,
      barterPreGas: 1,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: true,
      prevRatchet: 0,
    })
    const baseline = Math.max(AUTO_BASE_PERMIT, AUTO_BUMP_BUFFER_PCT)
    expect(r.slippagePct).toBeCloseTo(baseline, 9)
    // `bumped` is still false: the underlying numeric (1.027) is above
    // baseline by less than display precision.
  })

  it("a perfect-match barter (zero gas) leaves auto at exact baseline", () => {
    const r = simulateAuto({
      uniswapAmtOut: 1,
      barterPreGas: 1,
      gasCost: 0,
      isPermit: true,
      prevRatchet: 0,
    })
    const baseline = Math.max(AUTO_BASE_PERMIT, AUTO_BUMP_BUFFER_PCT)
    expect(r.slippagePct).toBeCloseTo(baseline, 9)
    expect(r.bumped).toBe(false)
  })

  it("ETH-path swaps see far less small-size pressure (gas ~10× smaller)", () => {
    const r = simulateAuto({
      uniswapAmtOut: 0.01,
      barterPreGas: 0.01,
      gasCost: ETH_PATH_GAS_COST_ETH,
      isPermit: false,
      prevRatchet: 0,
    })
    // 2.7e-5 / 0.01 × 100 = 0.27% shortfall. Linear: 0.27 + 1.0 = 1.27.
    // formatSlippage rounds to 1.3 (1 decimal precision).
    expect(r.shortfallPct).toBeCloseTo(0.27, 1)
    expect(r.slippagePct).toBeCloseTo(1.3, 9)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Discontinuity scan — find each step boundary where slippage jumps
// ──────────────────────────────────────────────────────────────────────────
describe("step-aligned discontinuities", () => {
  it("slippage transitions through the expected 0.1% steps as size grows", () => {
    const observed = new Set<number>()
    for (let eth = 0.001; eth <= 0.05; eth += 0.0005) {
      const r = simulateAuto({
        uniswapAmtOut: eth,
        barterPreGas: eth,
        gasCost: PERMIT_GAS_COST_ETH,
        isPermit: true,
        prevRatchet: 0,
      })
      observed.add(Math.round(r.slippagePct * 10))
    }
    // Should observe at least 5 distinct step values across this range.
    expect(observed.size).toBeGreaterThanOrEqual(5)
    // Every observed value should be an integer multiple of 0.1.
    for (const v of observed) {
      const slip = v / 10
      const stepUnits = Math.round(slip / 0.1)
      expect(Math.abs(slip - stepUnits * 0.1)).toBeLessThan(1e-9)
    }
  })

  it("the user's 8.8% observation maps to a real ~7.8% shortfall post-fix (linear)", () => {
    // Linear: shortfall + buffer. To produce 8.8% (formatted) the underlying
    // shortfall is 7.8%. Pre-fix this was step-rounded so any shortfall in
    // (7.7, 7.8] produced 8.8 — same display, but the fixed math is now
    // honestly continuous in the underlying.
    expect(parseFloat(computeAutoSlippage(7.8, true).slippage)).toBeCloseTo(8.8, 9)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Fuzz: pipeline invariants across random swap sizes and gas costs
// ──────────────────────────────────────────────────────────────────────────
describe("pipeline fuzz invariants", () => {
  it("auto slippage is always within [autoBase, SLIPPAGE_MAX] regardless of inputs", () => {
    const rng = mulberry32(101)
    for (let i = 0; i < 10_000; i++) {
      const isPermit = rng() < 0.5
      const eth = 1e-5 + rng() * 5 // 0.00001..5 ETH
      const gas = rng() * 0.01 // 0..0.01 ETH gas (deliberately wide)
      const ratchet = rng() < 0.2 ? rng() * 49 : 0 // sometimes pre-loaded ratchet
      const r = simulateAuto({
        uniswapAmtOut: eth,
        barterPreGas: eth * (0.95 + rng() * 0.1), // ±5% routing drift
        gasCost: gas,
        isPermit,
        prevRatchet: ratchet,
      })
      const floor = isPermit ? AUTO_BASE_PERMIT : AUTO_BASE_ETH
      expect(r.slippagePct).toBeGreaterThanOrEqual(floor - 1e-9)
      expect(r.slippagePct).toBeLessThanOrEqual(SLIPPAGE_MAX + 1e-9)
    }
  })

  it("with fresh ratchet, slippage is monotonic non-increasing in swap size — IF every observation passes the sanity gate", () => {
    const rng = mulberry32(7)
    // Constrain gas so the smallest swap in the sweep (0.001 ETH) still has
    // shortfall ≤ 50% — i.e. the (now lower) sanity gate doesn't fire.
    // gas/0.001 ≤ 50% means gas ≤ 5e-4 ETH.
    for (let cfg = 0; cfg < 200; cfg++) {
      const isPermit = rng() < 0.5
      const gas = 1e-5 + rng() * 4e-4 // safely under the new sanity gate
      const sizes: number[] = []
      for (let s = 0.001; s <= 1.0; s += 0.01) sizes.push(s)
      let prev = Infinity
      for (const eth of sizes) {
        const r = simulateAuto({
          uniswapAmtOut: eth,
          barterPreGas: eth,
          gasCost: gas,
          isPermit,
          prevRatchet: 0,
        })
        expect(r.sanityGated).toBe(false)
        expect(r.slippagePct).toBeLessThanOrEqual(prev + 1e-9)
        prev = r.slippagePct
      }
    }
  })

  it("FIXED (Problem 2): below-gate swaps ramp transparently; above-gate swaps surface 'swap too small'", () => {
    // Pre-fix: tiny swaps (gated at 90%) silently railed auto to 50%, no
    // explicit signal. Post-fix the gate is at 50% and gated swaps surface
    // sanityGated → amountTooSmall, while non-gated swaps see auto ramp
    // honestly to whatever the shortfall demands. No silent rail.
    const gas = 0.0006 // sanity-gates swaps where gas/output > 50%

    const tiny = simulateAuto({
      uniswapAmtOut: 0.001,
      barterPreGas: 0.001,
      gasCost: gas,
      isPermit: true,
      prevRatchet: 0,
    })
    expect(tiny.sanityGated).toBe(true)
    expect(tiny.slippagePct).toBeCloseTo(Math.max(AUTO_BASE_PERMIT, AUTO_BUMP_BUFFER_PCT), 9)

    const justOver = simulateAuto({
      uniswapAmtOut: 0.0014, // gas/output ≈ 43%, under the gate
      barterPreGas: 0.0014,
      gasCost: gas,
      isPermit: true,
      prevRatchet: 0,
    })
    expect(justOver.sanityGated).toBe(false)
    // Auto ramps honestly: shortfall ≈ 43% + 1% buffer = 44%. The user sees
    // exactly what slippage is required to execute — slippageWarning="high"
    // fires above 5%, so the cost-of-execution is visible.
    expect(justOver.slippagePct).toBeCloseTo(44, 0)
  })

  it("ratcheted slippage NEVER decreases across ticks within a session", () => {
    const rng = mulberry32(2026)
    for (let session = 0; session < 200; session++) {
      let ratchet = 0
      let lastSlippage = 0
      const isPermit = rng() < 0.5
      // 50 ticks per session, random small/large swaps, each *without* an
      // amount-change reset (i.e. simulate a single bound session).
      for (let tick = 0; tick < 50; tick++) {
        const eth = 1e-4 + rng() * 0.5
        const gas = 1e-5 + rng() * 1e-3
        const r = simulateAuto({
          uniswapAmtOut: eth,
          barterPreGas: eth,
          gasCost: gas,
          isPermit,
          prevRatchet: ratchet,
        })
        expect(r.slippagePct).toBeGreaterThanOrEqual(lastSlippage - 1e-9)
        ratchet = r.newRatchet
        lastSlippage = r.slippagePct
      }
    }
  })

  it("sanity gate is triggered exactly when |raw shortfall| > SANITY_GATE_PCT", () => {
    const rng = mulberry32(900)
    for (let i = 0; i < 5_000; i++) {
      const eth = 1e-5 + rng() * 0.1
      // Pick gas to cover the full range — including pathological cases.
      const gas = rng() * 0.5
      const r = simulateAuto({
        uniswapAmtOut: eth,
        barterPreGas: eth,
        gasCost: gas,
        isPermit: true,
        prevRatchet: 0,
      })
      const raw = ((eth - (eth - gas)) / eth) * 100 // = gas/eth × 100
      const shouldGate = Math.abs(raw) > SANITY_GATE_PCT
      expect(r.sanityGated).toBe(shouldGate)
    }
  })

  it("sanity-gated tick preserves prior ratchet (never resets it)", () => {
    const rng = mulberry32(43)
    for (let i = 0; i < 1_000; i++) {
      const startRatchet = rng() * 30
      const r = simulateAuto({
        uniswapAmtOut: 0.0001,
        barterPreGas: 0.0001,
        gasCost: 0.01, // huge → sanity-gated
        isPermit: true,
        prevRatchet: startRatchet,
      })
      expect(r.sanityGated).toBe(true)
      expect(r.newRatchet).toBeCloseTo(startRatchet, 9)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Documentation tests — what the user sees when they toggle 0.01 ↔ 0.011
// ──────────────────────────────────────────────────────────────────────────
describe("documented user-facing scenarios", () => {
  it("0.01 → 0.011 toggle (with production reset) shows the slippage drop the user observed", () => {
    // The user types 0.01 (auto bumps to ~3.7%), then changes to 0.011.
    // Production resets the ratchet on amount change, so 0.011 produces its
    // own auto value:
    //   shortfall ≈ 2.7e-4 / 0.011 × 100 ≈ 2.45% → ceil(2.45/0.1)*0.1 + 1 = 3.5%
    // Slippage drops from 3.7% → 3.5% (a small but real change).
    const t1 = simulateAuto({
      uniswapAmtOut: 0.01,
      barterPreGas: 0.01,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: true,
      prevRatchet: 0,
    })
    const t2 = simulateAuto({
      uniswapAmtOut: 0.011,
      barterPreGas: 0.011,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: true,
      prevRatchet: 0, // production reset
    })
    expect(t1.slippagePct).toBeGreaterThan(t2.slippagePct)
  })

  it("a high ratcheted shortfall produces auto = ratchet + buffer, clamped at SLIPPAGE_MAX", () => {
    const r = simulateAuto({
      uniswapAmtOut: 0.05,
      barterPreGas: 0.05,
      gasCost: PERMIT_GAS_COST_ETH,
      isPermit: true,
      prevRatchet: 49.5,
    })
    // 49.5 + 1.0 = 50.5 → clamped to SLIPPAGE_MAX (50).
    expect(r.slippagePct).toBe(SLIPPAGE_MAX)
  })

  it("computeAutoSlippage yields shortfall + buffer (linear, formatted at 0.1%)", () => {
    expect(parseFloat(computeAutoSlippage(2, true).slippage)).toBeCloseTo(3, 9)
    expect(parseFloat(computeAutoSlippage(2.5, true).slippage)).toBeCloseTo(3.5, 9)
    expect(parseFloat(computeAutoSlippage(7.8, true).slippage)).toBeCloseTo(8.8, 9)
    expect(parseFloat(computeAutoSlippage(40, true).slippage)).toBeCloseTo(41, 9)
  })

  it("auto rails at SLIPPAGE_MAX on extreme shortfall (only after the sanity gate has passed)", () => {
    expect(parseFloat(computeAutoSlippage(49.5, true).slippage)).toBe(SLIPPAGE_MAX)
    expect(parseFloat(computeAutoSlippage(80, true).slippage)).toBe(SLIPPAGE_MAX)
  })
})
