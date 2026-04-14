import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

const DEFAULT_DIVERGENCE_THRESHOLD_PCT = 25
const DEFAULT_TREASURY_MARGIN_PCT = 1.5

export async function GET() {
  try {
    const [divergence, treasuryMargin] = await Promise.all([
      get<number>("quote_guard_divergence_threshold_pct"),
      get<number>("quote_guard_treasury_margin_pct"),
    ])

    return NextResponse.json(
      {
        divergenceThresholdPct:
          typeof divergence === "number" && divergence > 0
            ? divergence
            : DEFAULT_DIVERGENCE_THRESHOLD_PCT,
        treasuryMarginPct:
          typeof treasuryMargin === "number" && treasuryMargin >= 0
            ? treasuryMargin
            : DEFAULT_TREASURY_MARGIN_PCT,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("[quote-guard] Edge Config read failed:", error)
    return NextResponse.json(
      {
        divergenceThresholdPct: DEFAULT_DIVERGENCE_THRESHOLD_PCT,
        treasuryMarginPct: DEFAULT_TREASURY_MARGIN_PCT,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
