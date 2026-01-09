import { NextResponse } from "next/server"
import { getSwapVolume } from "@/lib/analytics/services/transactions.service"
import { AnalyticsClientError } from "@/lib/analytics/client"

export async function GET() {
  try {
    const cumulativeSwapVolume = await getSwapVolume()

    if (cumulativeSwapVolume === null) {
      return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cumulativeSwapVolEth: cumulativeSwapVolume,
    })
  } catch (error) {
    console.error("Error fetching transaction volume analytics:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }

    return NextResponse.json(
      { error: "Failed to fetch transaction volume analytics" },
      { status: 500 }
    )
  }
}
