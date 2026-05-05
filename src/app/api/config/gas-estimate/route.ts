import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

const DEFAULT_GAS_LIMIT = 450_000
const DEFAULT_GAS_USED = 180_000
const DEFAULT_SURPLUS_RATE = 0.0056
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

export async function GET() {
  try {
    const [gasLimit, gasUsed, surplusRate, milesCalcMaxSlippage] = await Promise.all([
      get<number>("miles_estimate_gas_limit_average"),
      get<number>("miles_estimate_gas_used_average"),
      get<number>("miles_estimate_surplus_rate"),
      get<number>("miles_calc_max_slippage_pct"),
    ])

    return NextResponse.json(
      {
        gasEstimate: typeof gasLimit === "number" && gasLimit > 0 ? gasLimit : DEFAULT_GAS_LIMIT,
        gasUsedEstimate: typeof gasUsed === "number" && gasUsed > 0 ? gasUsed : DEFAULT_GAS_USED,
        surplusRate:
          typeof surplusRate === "number" && surplusRate > 0 ? surplusRate : DEFAULT_SURPLUS_RATE,
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
        milesCalcMaxSlippagePct: DEFAULT_MILES_CALC_MAX_SLIPPAGE,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
