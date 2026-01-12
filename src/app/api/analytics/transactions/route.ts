import { NextResponse } from "next/server"
import { getCumulativeSuccessfulTransactions } from "@/lib/analytics/services/transactions.service"
import { AnalyticsClientError } from "@/lib/analytics/client"

export async function GET() {
  try {
    const cumulativeTxs = await getCumulativeSuccessfulTransactions({
      catalog: "fastrpc",
    })

    if (cumulativeTxs === null) {
      return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cumulativeSuccessfulTxs: cumulativeTxs,
    })
  } catch (error) {
    console.error("Error fetching transaction analytics:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }

    return NextResponse.json({ error: "Failed to fetch transaction analytics" }, { status: 500 })
  }
}
