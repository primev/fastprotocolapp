import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"
import { PRO_MODE_MIN_USD } from "@/lib/pro-mode"

export const runtime = "edge"

export async function GET() {
  try {
    const threshold = await get<number>("pro_mode_min_usd")

    return NextResponse.json(
      {
        minUsd:
          typeof threshold === "number" && threshold > 0 ? threshold : PRO_MODE_MIN_USD,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("[pro-threshold] Edge Config read failed:", error)
    return NextResponse.json(
      { minUsd: PRO_MODE_MIN_USD },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
