/**
 * Miles math invariant tests.
 *
 * The forward miles calculation lives inside `useEstimatedMiles`'s memo, but
 * the underlying math is closed-form and tested here against the exported
 * `computeSurplusEth` helper. The same formulas drive:
 *   - the "exchange rate bar" miles estimate (forward),
 *   - `milesToSlippage` (inverse: target miles → slippage at given amount),
 *   - `maxAchievableMiles` (forward at slippage = 50%).
 *
 * Constants below mirror those in src/hooks/use-estimated-miles.ts.
 */

import { describe, it, expect } from "vitest"
import { computeSurplusEth } from "../use-estimated-miles"

// ──────────────────────────────────────────────────────────────────────────
// Constants — must match use-estimated-miles.ts
// ──────────────────────────────────────────────────────────────────────────
const USER_MEV_SHARE = 0.9
const MILES_PER_ETH = 100_000
/** Default cap mirrors `DEFAULT_MILES_CALC_MAX_SLIPPAGE_PCT`. The hook
 *  reads this from Edge Config (`miles_calc_max_slippage_pct`) at runtime
 *  — these tests parameterize the helpers below so we can exercise the
 *  default and any operator-set value with the same machinery. */
const DEFAULT_SLIPPAGE_MAX = 50
/** Tolerance the planner allows above the cap before declaring a target
 *  unreachable. Mirrors `MILES_CALC_SLIPPAGE_TOLERANCE_PCT`. */
const SLIPPAGE_TOLERANCE = 0.5
const SLIPPAGE_STEP = 0.01 // planner step
const ETH_DECIMALS = 18
const USDC_DECIMALS = 6

const wei = (eth: number) => BigInt(Math.round(eth * 1e18))
const usdc = (whole: number) => BigInt(Math.round(whole * 1e6))

// ──────────────────────────────────────────────────────────────────────────
// Pure math — replicates the forward / inverse formulas in the hook so we
// can exercise round-trip invariants without spinning up React state.
// ──────────────────────────────────────────────────────────────────────────
interface CostInputs {
  bidCostEth: number
  gasCostEth: number
  /**
   * Additive sweep overhead in ETH for non-ETH output. Mirrors the backend's
   * per-token p25 cost estimate (`cost_estimator.go`) — zero for ETH/WETH
   * output, otherwise drawn from the Edge Config map.
   */
  sweepOverheadEth: number
}

/** Forward: given the surplus (ETH) the contract retains, compute miles. */
function forwardMiles(surplusEth: number, c: CostInputs): number {
  const netMev = surplusEth - c.bidCostEth - c.gasCostEth - c.sweepOverheadEth
  if (netMev <= 0) return 0
  const userMev = netMev * USER_MEV_SHARE
  return Math.floor(userMev * MILES_PER_ETH)
}

/**
 * Inverse: given a target miles count + the forward calc's last observed
 * effective surplus rate, return the slippage that produces target.
 * Mirrors `milesToSlippage` in use-estimated-miles.ts. The `slippageMax`
 * parameter mirrors the Edge-Config-driven cap.
 */
function milesToSlippage(
  target: number,
  outputInEth: number,
  currentSlippagePct: number,
  lastEffectiveRate: number,
  c: CostInputs,
  autoBase: number,
  slippageMax: number = DEFAULT_SLIPPAGE_MAX
): number | null {
  if (target <= 0 || outputInEth <= 0) return null
  const userMevEth = target / MILES_PER_ETH
  const netMevEth = userMevEth / USER_MEV_SHARE
  const FLOOR_EPSILON = 5e-7
  const K = netMevEth + c.bidCostEth + c.gasCostEth + c.sweepOverheadEth + FLOOR_EPSILON
  const requiredRaw = currentSlippagePct + 100 * (K / outputInEth - lastEffectiveRate)
  const required = Math.ceil(requiredRaw / SLIPPAGE_STEP) * SLIPPAGE_STEP
  if (required > slippageMax + SLIPPAGE_TOLERANCE) return null
  return Math.min(slippageMax, Math.max(autoBase, required))
}

/** Inverse: max miles at given outputInEth and slippage = `slippageMax`. */
function maxMilesAtCap(
  parsedAmountOut: number,
  toTokenDecimals: number,
  isEthOutput: boolean,
  toTokenPrice: number | null,
  ethPrice: number | null,
  barterPreGas: bigint | null,
  outputInEth: number,
  c: CostInputs,
  slippageMax: number = DEFAULT_SLIPPAGE_MAX
): number | null {
  let surplusEth: number | null = null
  if (barterPreGas != null && barterPreGas > 0n) {
    surplusEth = computeSurplusEth({
      parsedAmountOut,
      slippagePct: slippageMax,
      barterPreGasOutputAmount: barterPreGas,
      toTokenDecimals,
      isEthOutput,
      toTokenPrice,
      ethPrice,
    })
  }
  if (surplusEth == null) {
    surplusEth = (slippageMax / 100) * outputInEth
  }
  return forwardMiles(surplusEth, c)
}

// Realistic cost values for tests:
//   priorityFee ≈ 0.06 gwei × gasLimit 450k = 27_000 gwei = 2.7e-5 ETH
//   baseFee     ≈ 1.5 gwei × gasUsed 180k = 270_000 gwei = 2.7e-4 ETH
//   sweepOverheadEth ≈ backend `costEstimateLastResort` = 0.001 ETH
const DEFAULT_COSTS: CostInputs = {
  bidCostEth: 2.7e-5,
  gasCostEth: 0, // ETH path doesn't deduct gasCost
  sweepOverheadEth: 0, // ETH output skips the sweep step
}

const PERMIT_COSTS: CostInputs = {
  bidCostEth: 2.7e-5,
  gasCostEth: 2.7e-4,
  sweepOverheadEth: 0.001, // non-ETH output: backend last-resort default
}

const ZERO_COSTS: CostInputs = {
  bidCostEth: 0,
  gasCostEth: 0,
  sweepOverheadEth: 0,
}

// ──────────────────────────────────────────────────────────────────────────
// Forward calc — known inputs/outputs
// ──────────────────────────────────────────────────────────────────────────
describe("forward miles — known cases", () => {
  it("gives zero miles when net MEV is negative", () => {
    const surplus = 0.000001 // tiny
    const c: CostInputs = { bidCostEth: 0.001, gasCostEth: 0, sweepOverheadEth: 0 }
    expect(forwardMiles(surplus, c)).toBe(0)
  })

  it("converts surplus to floor(0.9 × netMev × 100k) miles (zero costs)", () => {
    // Surplus 0.0011 ETH, no costs, sweep 1x.
    // userMev = 0.9 × 0.0011 = 0.00099 ETH
    // miles = floor(0.00099 × 100_000) = 99
    expect(forwardMiles(0.0011, ZERO_COSTS)).toBe(99)
  })

  it("clamps miles at floor (no rounding up)", () => {
    // Surplus 0.001000001 ETH → userMev ≈ 0.0009 → 90 miles (floor).
    expect(forwardMiles(0.001000001, ZERO_COSTS)).toBe(90)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Inverse: typed target → slippage
// ──────────────────────────────────────────────────────────────────────────
describe("milesToSlippage — known cases", () => {
  it("returns null when target is zero or negative", () => {
    expect(milesToSlippage(0, 0.05, 1, 0.01, DEFAULT_COSTS, 0.5)).toBeNull()
    expect(milesToSlippage(-5, 0.05, 1, 0.01, DEFAULT_COSTS, 0.5)).toBeNull()
  })

  it("returns null when target exceeds 50% slippage cap", () => {
    // Tiny outputInEth + huge target → required slippage > 50%.
    expect(milesToSlippage(1_000_000, 0.001, 1, 0.01, DEFAULT_COSTS, 0.5)).toBeNull()
  })

  it("clamps proposal at autoBase floor", () => {
    // Tiny target at large output → required would be < autoBase.
    const out = milesToSlippage(1, 100, 0.5, 0.005, DEFAULT_COSTS, 0.5)
    expect(out).not.toBeNull()
    expect(out!).toBeGreaterThanOrEqual(0.5 - 1e-9)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Round-trip: typed target → slippage → forward miles ≥ target
// (the user's "miles I apply must be added as is" requirement)
// ──────────────────────────────────────────────────────────────────────────
describe("inverse-then-forward round trip", () => {
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

  it("forward(amount, milesToSlippage(target)) ≥ target — fuzz, ETH path", () => {
    const rng = mulberry32(11)
    let asserts = 0
    for (let i = 0; i < 5_000; i++) {
      const outputInEth = 0.001 + rng() * 5 // 0.001..5 ETH
      const currentSlippage = 0.5 + rng() * 4 // 0.5..4.5%
      // Choose lastEffectiveRate close to currentSlippage/100 (typical
      // barter ≈ uniswap case, with small deviation).
      const lastEffectiveRate = currentSlippage / 100 + (rng() - 0.5) * 0.005
      const autoBase = 0.5
      // Target small enough to be reachable within 50%.
      const maxMiles = forwardMiles(outputInEth * (DEFAULT_SLIPPAGE_MAX / 100), DEFAULT_COSTS)
      if (maxMiles <= 1) continue
      const target = 1 + Math.floor(rng() * (maxMiles - 1))

      const s = milesToSlippage(
        target,
        outputInEth,
        currentSlippage,
        lastEffectiveRate,
        DEFAULT_COSTS,
        autoBase
      )
      if (s == null) continue
      // Skip targets where the tolerance window pinned the planner to the
      // cap — the tolerance trades a small under-delivery for the property
      // that "exactly maxAchievable" is always a clickable target. The
      // dedicated tolerance test above covers that path.
      if (s >= DEFAULT_SLIPPAGE_MAX - 1e-9) continue

      // Compute the forward result at this slippage (using the same
      // effective rate the planner assumed).
      const surplus = outputInEth * (lastEffectiveRate + (s - currentSlippage) / 100)
      const miles = forwardMiles(Math.max(0, surplus), DEFAULT_COSTS)

      // The planner must always meet OR exceed target — never undershoot.
      // (Over-shoot is acceptable: it occurs when slippage rounds UP to the
      // 0.01% step, or when target is so small it falls below the autoBase
      // floor's natural yield. Both are harmless directions.)
      expect(miles).toBeGreaterThanOrEqual(target)
      asserts++
    }
    // Ensure we actually exercised the path many times.
    expect(asserts).toBeGreaterThan(100)
  })

  it("ALL planner outputs sit within [autoBase, DEFAULT_SLIPPAGE_MAX]", () => {
    const rng = mulberry32(22)
    for (let i = 0; i < 5_000; i++) {
      const outputInEth = 0.001 + rng() * 5
      const currentSlippage = 0.5 + rng() * 4
      const lastEffectiveRate = currentSlippage / 100 + (rng() - 0.5) * 0.01
      const autoBase = rng() < 0.5 ? 0.5 : 1
      const target = 1 + Math.floor(rng() * 5_000)

      const s = milesToSlippage(
        target,
        outputInEth,
        currentSlippage,
        lastEffectiveRate,
        DEFAULT_COSTS,
        autoBase
      )
      if (s == null) continue
      expect(s).toBeGreaterThanOrEqual(autoBase - 1e-9)
      expect(s).toBeLessThanOrEqual(DEFAULT_SLIPPAGE_MAX + 1e-9)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Max miles — must be reachable by some slippage ≤ 50%
// ──────────────────────────────────────────────────────────────────────────
describe("maxAchievableMiles is consistent with the forward formula", () => {
  it("matches forward(amount, slippage=50%) when barter passes the sanity gate", () => {
    // outputInEth = 0.05 ETH, barter slightly better than uniswap (0.999×).
    const outputInEth = 0.05
    const parsedAmountOut = outputInEth // ETH output → no conversion
    const barterPreGas = wei(outputInEth * 0.999)
    const direct = computeSurplusEth({
      parsedAmountOut,
      slippagePct: DEFAULT_SLIPPAGE_MAX,
      barterPreGasOutputAmount: barterPreGas,
      toTokenDecimals: ETH_DECIMALS,
      isEthOutput: true,
      toTokenPrice: null,
      ethPrice: null,
    })!
    const expectedMiles = forwardMiles(direct, DEFAULT_COSTS)

    const maxMiles = maxMilesAtCap(
      parsedAmountOut,
      ETH_DECIMALS,
      true,
      null,
      null,
      barterPreGas,
      outputInEth,
      DEFAULT_COSTS
    )

    expect(maxMiles).toBe(expectedMiles)
  })

  it("returns 0 when costs exceed even max-slippage surplus (tiny swap)", () => {
    const outputInEth = 0.0001 // very small swap
    const tinyBarter = wei(outputInEth * 0.99)
    const expensive: CostInputs = {
      bidCostEth: 0.001,
      gasCostEth: 0,
      sweepOverheadEth: 0,
    }
    const max = maxMilesAtCap(
      outputInEth,
      ETH_DECIMALS,
      true,
      null,
      null,
      tinyBarter,
      outputInEth,
      expensive
    )
    expect(max).toBe(0)
  })

  it("returns 0 for a small permit-path swap (~$2 trade replicating real screenshot)", () => {
    // Replicates the case where a tiny ERC20→USDC swap can't earn miles
    // even at 50% slippage because the additive sweep overhead exceeds
    // 0.5×outputInEth. Surfaces the "Swap too small to earn miles at
    // current gas" message in the calc.
    //
    // ~$2 trade @ $3000 ETH → outputInEth ≈ 0.000667 ETH.
    // Permit-path costs: bid 2.7e-5 + gas 2.7e-4 + sweep overhead 1e-3
    // ≈ 1.3e-3 ETH, dwarfing the 0.5×0.000667 = 3.3e-4 ETH ceiling.
    const usdcOut = 1.95 // $1.95
    const outputInEth = (usdcOut * 1) / 3000
    const max = maxMilesAtCap(
      usdcOut,
      USDC_DECIMALS,
      false,
      1, // toTokenPrice (USDC = $1)
      3000, // ethPrice
      // Barter close to uniswap (passes sanity gate).
      usdc(usdcOut * 0.99),
      outputInEth,
      PERMIT_COSTS
    )
    expect(max).toBe(0)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Cross-token decimals — exercise USDC (6), WBTC (8), ETH (18) outputs
// ──────────────────────────────────────────────────────────────────────────
describe("decimals coverage — forward produces consistent results", () => {
  it("USDC output (6 dec): same trade gives same surplus ETH regardless of decimals scale", () => {
    // 3000 USDC out, barter 2997, slippage 0.5%, $1 USDC, $3000 ETH.
    const r = computeSurplusEth({
      parsedAmountOut: 3000,
      slippagePct: 0.5,
      barterPreGasOutputAmount: usdc(2997),
      toTokenDecimals: USDC_DECIMALS,
      isEthOutput: false,
      toTokenPrice: 1,
      ethPrice: 3000,
    })!
    // (2997 - 2985) USDC × $1 / $3000 = 0.004 ETH.
    expect(r).toBeCloseTo(0.004, 9)
    expect(forwardMiles(r, PERMIT_COSTS)).toBeGreaterThan(0)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Slippage drift sensitivity — small drift in barter routing shouldn't
// blow up miles (within reason)
// ──────────────────────────────────────────────────────────────────────────
describe("drift sensitivity", () => {
  it("1% drift in barter routing produces a bounded miles delta", () => {
    const outputInEth = 0.05
    const a = computeSurplusEth({
      parsedAmountOut: outputInEth,
      slippagePct: 5,
      barterPreGasOutputAmount: wei(outputInEth * 0.99),
      toTokenDecimals: ETH_DECIMALS,
      isEthOutput: true,
      toTokenPrice: null,
      ethPrice: null,
    })!
    const b = computeSurplusEth({
      parsedAmountOut: outputInEth,
      slippagePct: 5,
      barterPreGasOutputAmount: wei(outputInEth * 0.98),
      toTokenDecimals: ETH_DECIMALS,
      isEthOutput: true,
      toTokenPrice: null,
      ethPrice: null,
    })!
    const mA = forwardMiles(a, DEFAULT_COSTS)
    const mB = forwardMiles(b, DEFAULT_COSTS)
    // 1% relative drift in barter → ~1% delta in miles, not orders of magnitude.
    expect(Math.abs(mA - mB)).toBeLessThan(Math.max(mA, mB))
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Operator-tunable cap (Edge Config: `miles_calc_max_slippage_pct`)
//
// The miles calculator's slippage ceiling is read from Edge Config by
// `useEstimatedMiles` so operators can tune it without redeploying. These
// tests exercise the math at non-default caps to confirm:
//   • lowering the cap shrinks `maxAchievableMiles` proportionally
//   • the inverse rejects targets that would have been reachable at 50%
//   • the FLOOR_EPSILON tolerance still admits exactly-max targets at
//     any cap value
// ──────────────────────────────────────────────────────────────────────────
describe("operator-tunable slippage cap", () => {
  it("maxMilesAtCap shrinks roughly linearly when the cap drops 50% → 25%", () => {
    // ETH-output, ETH-path. Routing premium fixed at 0.2% of output so the
    // diff comes purely from the slippage term in
    //   surplus = barterPreGas − parsedOut × (1 − cap/100)
    const outputInEth = 0.5
    const barterPreGas = wei(outputInEth * 0.998)
    const at50 = maxMilesAtCap(
      outputInEth,
      ETH_DECIMALS,
      true,
      null,
      null,
      barterPreGas,
      outputInEth,
      DEFAULT_COSTS,
      50
    )!
    const at25 = maxMilesAtCap(
      outputInEth,
      ETH_DECIMALS,
      true,
      null,
      null,
      barterPreGas,
      outputInEth,
      DEFAULT_COSTS,
      25
    )!
    // surplus(50%) = 0.998·X − 0.5·X = 0.498·X
    // surplus(25%) = 0.998·X − 0.75·X = 0.248·X
    // ratio ≈ 0.498 → at25 ≈ 0.498 × at50 (within floor() rounding)
    expect(at25).toBeGreaterThan(0)
    expect(at25).toBeLessThan(at50)
    expect(at25 / at50).toBeCloseTo(0.248 / 0.498, 1)
  })

  it("maxMilesAtCap=10 collapses to a small fraction of the 50% value", () => {
    const outputInEth = 1
    const barterPreGas = wei(outputInEth * 0.999)
    const at50 = maxMilesAtCap(
      outputInEth,
      ETH_DECIMALS,
      true,
      null,
      null,
      barterPreGas,
      outputInEth,
      DEFAULT_COSTS,
      50
    )!
    const at10 = maxMilesAtCap(
      outputInEth,
      ETH_DECIMALS,
      true,
      null,
      null,
      barterPreGas,
      outputInEth,
      DEFAULT_COSTS,
      10
    )!
    // surplus(50%)/surplus(10%) ≈ (0.999−0.5)/(0.999−0.9) = 0.499/0.099 ≈ 5×
    expect(at50 / at10).toBeCloseTo(0.499 / 0.099, 0)
  })

  it("milesToSlippage rejects a target that needs > cap + tolerance", () => {
    // At cap=25, a target that requires ~30% slippage is rejected, even
    // though it would have been reachable when the cap was 50.
    const outputInEth = 1
    const lastEffectiveRate = 0.005 // 0.5% routing premium baked in
    // Target sized so requiredRaw lands ~30% — well past 25 + 0.5 tolerance.
    const target = forwardMiles(outputInEth * 0.3, DEFAULT_COSTS)
    expect(
      milesToSlippage(target, outputInEth, 1, lastEffectiveRate, DEFAULT_COSTS, 0.5, 25)
    ).toBeNull()
    // Same target IS reachable when the cap is the default 50.
    expect(
      milesToSlippage(target, outputInEth, 1, lastEffectiveRate, DEFAULT_COSTS, 0.5, 50)
    ).not.toBeNull()
  })

  it("milesToSlippage admits exactly-max target at a custom cap (FLOOR_EPSILON tolerance)", () => {
    // The forward at cap = 25 gives some max M; the inverse called with M
    // must succeed (clamped to 25), not return null. This is the bug the
    // tolerance window was added to fix; needs to hold at any cap value.
    for (const cap of [10, 25, 33, 50]) {
      const outputInEth = 0.5
      const barterPreGas = wei(outputInEth * 0.999)
      const max = maxMilesAtCap(
        outputInEth,
        ETH_DECIMALS,
        true,
        null,
        null,
        barterPreGas,
        outputInEth,
        DEFAULT_COSTS,
        cap
      )!
      // Use the routing-premium based effective rate the forward would have
      // observed at the user's current slippage (1%).
      const lastEffectiveRate =
        computeSurplusEth({
          parsedAmountOut: outputInEth,
          slippagePct: 1,
          barterPreGasOutputAmount: barterPreGas,
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })! / outputInEth
      const slippage = milesToSlippage(
        max,
        outputInEth,
        1,
        lastEffectiveRate,
        DEFAULT_COSTS,
        0.5,
        cap
      )
      expect(slippage).not.toBeNull()
      expect(slippage!).toBeLessThanOrEqual(cap + 1e-9)
    }
  })

  it("planner output never exceeds the operator-set cap (fuzzed)", () => {
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
    const rng = mulberry32(42)
    for (let i = 0; i < 500; i++) {
      const cap = 5 + rng() * 45 // 5–50%
      const outputInEth = 0.001 + rng() * 5
      const lastEffectiveRate = rng() * 0.05
      const target = Math.floor(rng() * 5000)
      if (target <= 0) continue
      const s = milesToSlippage(target, outputInEth, 1, lastEffectiveRate, DEFAULT_COSTS, 0.5, cap)
      if (s == null) continue
      // Final clamped slippage is always ≤ cap (Math.min in the helper).
      expect(s).toBeLessThanOrEqual(cap + 1e-9)
    }
  })
})
