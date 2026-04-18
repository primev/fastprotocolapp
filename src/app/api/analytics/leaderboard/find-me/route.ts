import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { findUserInLeaderboard } from "@/lib/analytics/services/leaderboard.service"
import { AnalyticsClientError } from "@/lib/analytics/client"
import { parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const querySchema = z.object({
  wallet: walletAddressSchema,
  // Defaults mirror the UI: volume leaderboard, volume sort, all tiers.
  category: z.enum(["volume", "efficiency", "rising"]).default("volume"),
  sort: z.string().default("volume"),
  tier: z.string().default("all"),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

/**
 * GET /api/analytics/leaderboard/find-me?wallet=0x...&category=volume&sort=volume&tier=all&pageSize=25
 * Returns the user's rank and which page they appear on in a paginated leaderboard.
 */
export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const { wallet, category, sort, tier, pageSize } = parsed

  try {
    const result = await findUserInLeaderboard({ wallet, category, sort, tier, pageSize })

    if (!result) {
      return NextResponse.json(
        { success: true, found: false },
        { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" } }
      )
    }

    return NextResponse.json(
      { success: true, found: true, rank: result.rank, page: result.page },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" } }
    )
  } catch (error) {
    console.error("Error in find-me:", error)
    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }
    return NextResponse.json({ error: "Failed to find user" }, { status: 500 })
  }
}
