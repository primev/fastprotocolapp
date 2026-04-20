import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"
import {
  DEFAULT_SURPLUS_BUCKETS,
  isSurplusBuckets,
  type SurplusBuckets,
} from "@/lib/surplus-rate"

export const runtime = "edge"

const DEFAULT_GAS_LIMIT = 450_000
const DEFAULT_GAS_USED = 180_000

export async function GET() {
  try {
    const [gasLimit, gasUsed, scalarRate, bucketsRaw] = await Promise.all([
      get<number>("miles_estimate_gas_limit_average"),
      get<number>("miles_estimate_gas_used_average"),
      get<number>("miles_estimate_surplus_rate"),
      get<unknown>("miles_estimate_surplus_buckets"),
    ])

    const surplusBuckets: SurplusBuckets = isSurplusBuckets(bucketsRaw)
      ? bucketsRaw
      : DEFAULT_SURPLUS_BUCKETS

    // Legacy scalar — prefer the Edge Config value if present, otherwise use
    // the medium bucket as the "typical swap" fallback so older consumers
    // still get sensible numbers.
    const surplusRate =
      typeof scalarRate === "number" && scalarRate > 0 ? scalarRate : surplusBuckets.rates.medium

    return NextResponse.json(
      {
        gasEstimate: typeof gasLimit === "number" && gasLimit > 0 ? gasLimit : DEFAULT_GAS_LIMIT,
        gasUsedEstimate: typeof gasUsed === "number" && gasUsed > 0 ? gasUsed : DEFAULT_GAS_USED,
        surplusRate,
        surplusBuckets,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("[gas-estimate] Edge Config read failed:", error)
    return NextResponse.json(
      {
        gasEstimate: DEFAULT_GAS_LIMIT,
        gasUsedEstimate: DEFAULT_GAS_USED,
        surplusRate: DEFAULT_SURPLUS_BUCKETS.rates.medium,
        surplusBuckets: DEFAULT_SURPLUS_BUCKETS,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
