import { NextResponse } from "next/server"
import { getRecentL1SwapTxHashes } from "@/lib/analytics/services/l1-transactions.service"
import { AnalyticsClientError } from "@/lib/analytics/client"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 1000)

  try {
    const hashes = await getRecentL1SwapTxHashes(limit)

    if (hashes.length === 0) {
      return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: hashes.length,
      hashes,
    })
  } catch (error) {
    console.error("Error fetching L1 swap tx hashes:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }

    return NextResponse.json({ error: "Failed to fetch L1 swap tx hashes" }, { status: 500 })
  }
}
