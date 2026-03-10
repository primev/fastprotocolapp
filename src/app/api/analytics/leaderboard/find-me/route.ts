import { NextRequest, NextResponse } from "next/server"
import { findUserInLeaderboard } from "@/lib/analytics/services/leaderboard.service"
import { AnalyticsClientError } from "@/lib/analytics/client"

/**
 * GET /api/analytics/leaderboard/find-me?wallet=0x...&category=volume&sort=volume&tier=all&pageSize=25
 *
 * Returns the user's rank and which page they appear on in a paginated leaderboard.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get("wallet")
    const category = searchParams.get("category") || "volume"
    const sort = searchParams.get("sort") || "volume"
    const tier = searchParams.get("tier") || "all"
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "25", 10), 1), 100)

    if (!wallet) {
      return NextResponse.json({ error: "wallet parameter is required" }, { status: 400 })
    }

    const result = await findUserInLeaderboard({ wallet, category, sort, tier, pageSize })

    if (!result) {
      return NextResponse.json({ success: true, found: false }, {
        headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
      })
    }

    return NextResponse.json({
      success: true,
      found: true,
      rank: result.rank,
      page: result.page,
    }, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
    })
  } catch (error) {
    console.error("Error in find-me:", error)
    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }
    return NextResponse.json({ error: "Failed to find user" }, { status: 500 })
  }
}
