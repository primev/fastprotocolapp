import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

const DEFAULT_FEE_PERCENTILE = 55

export async function GET() {
  try {
    const feePercentile = await get<number>("miles_estimate_fee_percentile")
    return NextResponse.json({
      feePercentile:
        typeof feePercentile === "number" && feePercentile > 0 && feePercentile <= 100
          ? feePercentile
          : DEFAULT_FEE_PERCENTILE,
    })
  } catch (error) {
    console.error("[fee-percentile] Edge Config read failed:", error)
    return NextResponse.json({ feePercentile: DEFAULT_FEE_PERCENTILE })
  }
}
