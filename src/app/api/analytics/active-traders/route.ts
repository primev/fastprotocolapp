import { NextResponse } from "next/server"
import { getActiveTraders } from "@/lib/analytics/services/transactions.service"
import { AnalyticsClientError } from "@/lib/analytics/client"

export async function GET() {
  try {
    const activeTraders = await getActiveTraders({
      catalog: "fastrpc",
    })

    if (activeTraders === null) {
      return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      activeTraders: activeTraders,
    })
  } catch (error) {
    console.error("Error fetching active traders analytics:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }

    return NextResponse.json({ error: "Failed to fetch active traders analytics" }, { status: 500 })
  }
}
