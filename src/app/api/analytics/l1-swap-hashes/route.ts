import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getRecentL1SwapTxHashes } from "@/lib/analytics/services/l1-transactions.service"
import { AnalyticsClientError } from "@/lib/analytics/client"
import { parseSearchParams } from "@/lib/api/parse"

// Upper bound of 1000 is a server-side DoS guard — the analytics service
// has no built-in limit of its own and a naïve client could otherwise
// ask for millions of hashes.
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(200),
})

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (!parsed.ok) return parsed.response
  const { limit } = parsed.data

  try {
    const hashes = await getRecentL1SwapTxHashes(limit)

    if (hashes.length === 0) {
      return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: hashes.length, hashes })
  } catch (error) {
    console.error("Error fetching L1 swap tx hashes:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }

    return NextResponse.json({ error: "Failed to fetch L1 swap tx hashes" }, { status: 500 })
  }
}
