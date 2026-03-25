import { NextRequest, NextResponse } from "next/server"
import { getAnalyticsClient } from "@/lib/analytics/client"

/**
 * Queries mctransactions for a swap's preconfirmation status.
 * Returns: "preconfirmed" | "confirmed" | "failed" | null (not found yet)
 * Note: DB stores "pre-confirmed" — normalized to "preconfirmed" by the client-side fetcher.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await params

    if (!hash) {
      return NextResponse.json({ status: null, error: "Hash required" }, { status: 400 })
    }

    const client = getAnalyticsClient()
    const rows = await client.executeRaw(
      `SELECT status FROM mctransactions WHERE lower(hash) = lower(:hash) LIMIT 1`,
      { hash },
      { catalog: "fastrpc", timeout: 5000 }
    )

    if (rows.length === 0) {
      return NextResponse.json({ status: null })
    }

    const status = rows[0][0] as string
    return NextResponse.json({ status })
  } catch (error) {
    console.error("[fast-tx-status] Query failed:", error)
    return NextResponse.json({ status: null, error: "Query failed" }, { status: 500 })
  }
}
