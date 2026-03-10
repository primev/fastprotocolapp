import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"
import { LEADERBOARD_CACHE_STALE_TIME } from "@/lib/constants"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"

const FUUL_LEADERBOARD_URL = "https://api.fuul.xyz/api/v1/payouts/leaderboard/points"

// In-memory cache for the raw Fuul response
let rawCache: { data: NormalizedEntry[]; timestamp: number } | null = null

interface FuulLeaderboardEntry {
  address: string
  total_amount: number
  total_attributions: number
  rank: number
  affiliate_name: string | null
}

interface NormalizedEntry {
  wallet: string
  points: number
  referrals: number
}

/**
 * GET /api/fuul/leaderboard?limit=15&page=1&sort=refs|miles
 *
 * Returns referral leaderboard with both sorts pre-computed from a single Fuul API call.
 * When page is provided, returns paginated results.
 */
export async function GET(request: NextRequest) {
  try {
    const fuulApiKey = env.FUUL_API_KEY
    if (!fuulApiKey) {
      console.error("FUUL_API_KEY not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "15", 10), 1), 100)
    const page = parseInt(searchParams.get("page") || "0", 10)
    const sort = searchParams.get("sort") || ""

    // Ensure we have cached data
    if (!rawCache || Date.now() - rawCache.timestamp >= LEADERBOARD_CACHE_STALE_TIME) {
      const url = new URL(FUUL_LEADERBOARD_URL)
      url.searchParams.set("page", "1")
      url.searchParams.set("page_size", "100")

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${fuulApiKey}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Fuul leaderboard API error:", response.status, errorText)
        return NextResponse.json(
          { error: "Failed to fetch referral leaderboard" },
          { status: response.status }
        )
      }

      const data = await response.json()
      const results: FuulLeaderboardEntry[] = data.results || []

      rawCache = {
        data: results.map((r) => ({
          wallet: trimWalletAddress(r.address),
          points: Number(r.total_amount) || 0,
          referrals: Number(r.total_attributions) || 0,
        })),
        timestamp: Date.now(),
      }
    }

    const allEntries = rawCache.data

    // Paginated mode
    if (page > 0) {
      const sorted = sort === "miles"
        ? [...allEntries].sort((a, b) => b.points - a.points)
        : [...allEntries].sort((a, b) => b.referrals - a.referrals)

      const total = sorted.length
      const totalPages = Math.ceil(total / limit)
      const offset = (page - 1) * limit
      const pageEntries = sorted.slice(offset, offset + limit).map((e, i) => ({
        ...e,
        rank: offset + i + 1,
      }))

      return NextResponse.json({
        success: true,
        entries: pageEntries,
        pagination: { page, limit, total, totalPages },
      }, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
      })
    }

    // Non-paginated mode (card preview) — returns both sorts
    return NextResponse.json(buildResponse(allEntries, limit), {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
    })
  } catch (error) {
    console.error("Error fetching referral leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch referral leaderboard" }, { status: 500 })
  }
}

function buildResponse(entries: NormalizedEntry[], limit: number) {
  const byPoints = entries
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  const byRefs = entries
    .slice()
    .sort((a, b) => b.referrals - a.referrals)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  return { success: true, byPoints, byRefs }
}
