import { NextResponse } from "next/server"
import { getSwapCount } from "@/lib/analytics/services/transactions.service"
import { AnalyticsClientError } from "@/lib/analytics/client"

export async function GET() {
  try {
    const swapTxCount = await getSwapCount()

    if (swapTxCount === null) {
      return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      swapTxCount: swapTxCount,
    })
  } catch (error) {
    console.error("Error fetching swap count:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }

    return NextResponse.json({ error: "Failed to fetch swap count" }, { status: 500 })
  }
}
