import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

const DEFAULT_GAS_ESTIMATE = 450_000

export async function GET() {
  try {
    const gasEstimate = await get<number>("miles_estimate_gas_limit_average")
    return NextResponse.json(
      {
        gasEstimate:
          typeof gasEstimate === "number" && gasEstimate > 0 ? gasEstimate : DEFAULT_GAS_ESTIMATE,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("[gas-estimate] Edge Config read failed:", error)
    return NextResponse.json(
      { gasEstimate: DEFAULT_GAS_ESTIMATE },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
