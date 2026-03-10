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
 * GET /api/fuul/leaderboard?limit=15
 *
 * Returns referral leaderboard with both sorts pre-computed from a single Fuul API call.
 * Response: { byPoints: [...], byRefs: [...] }
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

    // Check cache
    if (rawCache && Date.now() - rawCache.timestamp < LEADERBOARD_CACHE_STALE_TIME) {
      return NextResponse.json(buildResponse(rawCache.data, limit), {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
      })
    }

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

    const normalized: NormalizedEntry[] = results.map((r) => ({
      wallet: trimWalletAddress(r.address),
      points: Number(r.total_amount) || 0,
      referrals: Number(r.total_attributions) || 0,
    }))

    rawCache = { data: normalized, timestamp: Date.now() }

    return NextResponse.json(buildResponse(normalized, limit), {
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
