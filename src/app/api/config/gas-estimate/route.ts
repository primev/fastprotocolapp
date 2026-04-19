import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

const DEFAULT_GAS_LIMIT = 450_000
const DEFAULT_GAS_USED = 180_000
const DEFAULT_SURPLUS_RATE = 0.0056

export async function GET() {
  try {
    const [gasLimit, gasUsed, surplusRate] = await Promise.all([
      get<number>("miles_estimate_gas_limit_average"),
      get<number>("miles_estimate_gas_used_average"),
      get<number>("miles_estimate_surplus_rate"),
    ])

    return NextResponse.json(
      {
        gasEstimate: typeof gasLimit === "number" && gasLimit > 0 ? gasLimit : DEFAULT_GAS_LIMIT,
        gasUsedEstimate: typeof gasUsed === "number" && gasUsed > 0 ? gasUsed : DEFAULT_GAS_USED,
        surplusRate:
          typeof surplusRate === "number" && surplusRate > 0 ? surplusRate : DEFAULT_SURPLUS_RATE,
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
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
