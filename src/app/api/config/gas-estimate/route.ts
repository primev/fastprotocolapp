import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

const DEFAULT_GAS_LIMIT = 450_000
const DEFAULT_GAS_USED = 180_000
const DEFAULT_SURPLUS_RATE = 0.0056
/**
 * Cold-load fallback for the sweep-overhead map. Mirrors the backend's
 * `costEstimateLastResort` in `fastswap-miles/cost_estimator.go`. Used
 * only when Edge Config has no `miles_estimate_sweep_overhead_eth_by_token`
 * entry at all (e.g. the hourly cron hasn't run for the first time yet);
 * once populated, the cron writes a `default` key alongside per-token
 * values and clients read that instead.
 */
const DEFAULT_SWEEP_OVERHEAD_FALLBACK: Record<string, number> = { default: 0.001 }
/**
 * Cold-load fallback for the dashboard MilesCell bid-cost proxy. Same
 * value the cron writes when no rows are sampled. Tracks p75 of realized
 * bid_cost since 2026-04-08; tight enough post-fix that a single
 * scalar is fine.
 */
const DEFAULT_BID_COST_ETH = 0.00004
/** Default upper bound the miles calculator will plan against, in percent. */
const DEFAULT_MILES_CALC_MAX_SLIPPAGE = 50
/** Hard floors and ceilings for the calc cap so a bad Edge Config value can't
 *  break the inverse planner. The min must stay above the path autoBase
 *  (1% on permit) so `Math.min(SLIPPAGE_MAX, Math.max(autoBase, …))` doesn't
 *  collapse the planner's range to zero. */
const MILES_CALC_MAX_SLIPPAGE_FLOOR = 1
const MILES_CALC_MAX_SLIPPAGE_CEILING = 50

function clampMaxSlippage(value: number): number {
  return Math.min(MILES_CALC_MAX_SLIPPAGE_CEILING, Math.max(MILES_CALC_MAX_SLIPPAGE_FLOOR, value))
}

function isSweepOverheadMap(value: unknown): value is Record<string, number> {
  if (value == null || typeof value !== "object") return false
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return false
  }
  return true
}

export async function GET() {
  try {
    const [gasLimit, gasUsed, surplusRate, sweepOverheadByToken, bidCostEth, milesCalcMaxSlippage] =
      await Promise.all([
        get<number>("miles_estimate_gas_limit_average"),
        get<number>("miles_estimate_gas_used_average"),
        get<number>("miles_estimate_surplus_rate"),
        get<Record<string, number>>("miles_estimate_sweep_overhead_eth_by_token"),
        get<number>("miles_estimate_bid_cost_eth"),
        get<number>("miles_calc_max_slippage_pct"),
      ])

    return NextResponse.json(
      {
        gasEstimate: typeof gasLimit === "number" && gasLimit > 0 ? gasLimit : DEFAULT_GAS_LIMIT,
        gasUsedEstimate: typeof gasUsed === "number" && gasUsed > 0 ? gasUsed : DEFAULT_GAS_USED,
        surplusRate:
          typeof surplusRate === "number" && surplusRate > 0 ? surplusRate : DEFAULT_SURPLUS_RATE,
        sweepOverheadByToken: isSweepOverheadMap(sweepOverheadByToken)
          ? sweepOverheadByToken
          : DEFAULT_SWEEP_OVERHEAD_FALLBACK,
        bidCostEth:
          typeof bidCostEth === "number" && bidCostEth > 0 ? bidCostEth : DEFAULT_BID_COST_ETH,
        milesCalcMaxSlippagePct:
          typeof milesCalcMaxSlippage === "number" && milesCalcMaxSlippage > 0
            ? clampMaxSlippage(milesCalcMaxSlippage)
            : DEFAULT_MILES_CALC_MAX_SLIPPAGE,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("[gas-estimate] Edge Config read failed:", error)
    return NextResponse.json(
      {
        gasEstimate: DEFAULT_GAS_LIMIT,
        gasUsedEstimate: DEFAULT_GAS_USED,
        surplusRate: DEFAULT_SURPLUS_RATE,
        sweepOverheadByToken: DEFAULT_SWEEP_OVERHEAD_FALLBACK,
        bidCostEth: DEFAULT_BID_COST_ETH,
        milesCalcMaxSlippagePct: DEFAULT_MILES_CALC_MAX_SLIPPAGE,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
