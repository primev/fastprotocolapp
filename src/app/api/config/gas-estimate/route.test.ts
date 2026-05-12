import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock @vercel/edge-config's `get` so we can drive the keys per-test without
// hitting any real config store. The route reads four keys today; this lets
// us return whatever shape we need (number | null | bad type).
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }))

vi.mock("@vercel/edge-config", () => ({
  get: mockGet,
}))

// Import AFTER the mock is registered.
import { GET } from "./route"

const DEFAULT_GAS_LIMIT = 450_000
const DEFAULT_GAS_USED = 180_000
const DEFAULT_SURPLUS_RATE = 0.0056
const DEFAULT_MILES_CALC_MAX_SLIPPAGE = 50
/** Mirrors `DEFAULT_SWEEP_OVERHEAD_FALLBACK` in route.ts and the backend's
 *  `costEstimateLastResort` (cost_estimator.go). */
const DEFAULT_SWEEP_OVERHEAD: Record<string, number> = { default: 0.001 }
/** Mirrors `DEFAULT_BID_COST_ETH` in route.ts — p75 of post-Apr-8 realized. */
const DEFAULT_BID_COST_ETH = 0.00004

/**
 * Build a `mockGet` implementation that returns the values we want for each
 * Edge Config key. Any key not present in the map resolves to `undefined`,
 * which the route treats as "use default."
 */
function mockKeys(values: Partial<Record<string, unknown>>) {
  mockGet.mockImplementation(async (key: string) => values[key])
}

describe("GET /api/config/gas-estimate", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it("returns defaults when all Edge Config keys are missing", async () => {
    mockKeys({})
    const res = await GET()
    const json = await res.json()

    expect(json).toEqual({
      gasEstimate: DEFAULT_GAS_LIMIT,
      gasUsedEstimate: DEFAULT_GAS_USED,
      surplusRate: DEFAULT_SURPLUS_RATE,
      sweepOverheadByToken: DEFAULT_SWEEP_OVERHEAD,
      bidCostEth: DEFAULT_BID_COST_ETH,
      milesCalcMaxSlippagePct: DEFAULT_MILES_CALC_MAX_SLIPPAGE,
    })
  })

  it("passes through valid operator-set values", async () => {
    const sweepMap = {
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": 0.00004,
      "0xdac17f958d2ee523a2206206994597c13d831ec7": 0.00005,
      default: 0.00008,
    }
    mockKeys({
      miles_estimate_gas_limit_average: 500_000,
      miles_estimate_gas_used_average: 200_000,
      miles_estimate_surplus_rate: 0.012,
      miles_estimate_sweep_overhead_eth_by_token: sweepMap,
      miles_estimate_bid_cost_eth: 0.000038,
      miles_calc_max_slippage_pct: 25,
    })
    const res = await GET()
    const json = await res.json()

    expect(json).toEqual({
      gasEstimate: 500_000,
      gasUsedEstimate: 200_000,
      surplusRate: 0.012,
      sweepOverheadByToken: sweepMap,
      bidCostEth: 0.000038,
      milesCalcMaxSlippagePct: 25,
    })
  })

  it("falls back to default sweep overhead when the map has a bad value", async () => {
    mockKeys({
      // negative overhead is nonsensical — the route should reject and fall back
      miles_estimate_sweep_overhead_eth_by_token: { "0xfoo": -1 },
    })
    const res = await GET()
    const json = await res.json()
    expect(json.sweepOverheadByToken).toEqual(DEFAULT_SWEEP_OVERHEAD)
  })

  it("falls back to default sweep overhead when the map is non-object", async () => {
    mockKeys({ miles_estimate_sweep_overhead_eth_by_token: "not a map" })
    const res = await GET()
    const json = await res.json()
    expect(json.sweepOverheadByToken).toEqual(DEFAULT_SWEEP_OVERHEAD)
  })

  it("clamps milesCalcMaxSlippagePct above the 50% ceiling", async () => {
    mockKeys({ miles_calc_max_slippage_pct: 75 })
    const res = await GET()
    const json = await res.json()
    // The cap is hard-bounded: a typo or out-of-range value can't unlock
    // slippage > 50% in the calculator.
    expect(json.milesCalcMaxSlippagePct).toBe(50)
  })

  it("clamps milesCalcMaxSlippagePct below the 1% floor", async () => {
    mockKeys({ miles_calc_max_slippage_pct: 0.25 })
    const res = await GET()
    const json = await res.json()
    // A value too small would drop the planner's cap below path autoBase
    // (1% on permit), collapsing the inverse range to zero. Clamp to the
    // floor instead.
    expect(json.milesCalcMaxSlippagePct).toBe(1)
  })

  it("falls back to default when milesCalcMaxSlippagePct is non-numeric", async () => {
    mockKeys({ miles_calc_max_slippage_pct: "twenty-five" })
    const res = await GET()
    const json = await res.json()
    expect(json.milesCalcMaxSlippagePct).toBe(DEFAULT_MILES_CALC_MAX_SLIPPAGE)
  })

  it("falls back to default when milesCalcMaxSlippagePct is null", async () => {
    mockKeys({ miles_calc_max_slippage_pct: null })
    const res = await GET()
    const json = await res.json()
    expect(json.milesCalcMaxSlippagePct).toBe(DEFAULT_MILES_CALC_MAX_SLIPPAGE)
  })

  it("falls back to default when milesCalcMaxSlippagePct is zero or negative", async () => {
    mockKeys({ miles_calc_max_slippage_pct: 0 })
    let res = await GET()
    let json = await res.json()
    expect(json.milesCalcMaxSlippagePct).toBe(DEFAULT_MILES_CALC_MAX_SLIPPAGE)

    mockKeys({ miles_calc_max_slippage_pct: -10 })
    res = await GET()
    json = await res.json()
    expect(json.milesCalcMaxSlippagePct).toBe(DEFAULT_MILES_CALC_MAX_SLIPPAGE)
  })

  it("returns defaults when Edge Config throws", async () => {
    mockGet.mockRejectedValue(new Error("edge config offline"))
    const res = await GET()
    const json = await res.json()

    expect(json).toEqual({
      gasEstimate: DEFAULT_GAS_LIMIT,
      gasUsedEstimate: DEFAULT_GAS_USED,
      surplusRate: DEFAULT_SURPLUS_RATE,
      sweepOverheadByToken: DEFAULT_SWEEP_OVERHEAD,
      bidCostEth: DEFAULT_BID_COST_ETH,
      milesCalcMaxSlippagePct: DEFAULT_MILES_CALC_MAX_SLIPPAGE,
    })
  })

  it("each Edge Config key is fetched exactly once per request", async () => {
    mockKeys({})
    await GET()
    const fetchedKeys = mockGet.mock.calls.map(([k]) => k as string).sort()
    expect(fetchedKeys).toEqual(
      [
        "miles_calc_max_slippage_pct",
        "miles_estimate_bid_cost_eth",
        "miles_estimate_gas_limit_average",
        "miles_estimate_gas_used_average",
        "miles_estimate_surplus_rate",
        "miles_estimate_sweep_overhead_eth_by_token",
      ].sort()
    )
  })
})
