import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"
import { LEADERBOARD_CACHE_STALE_TIME } from "@/lib/constants"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"

const FUUL_LEADERBOARD_URL = "https://api.fuul.xyz/api/v1/payouts/leaderboard/points"
const FUUL_FETCH_TIMEOUT = 8_000 // 8 seconds — fail fast if Fuul is slow

// In-memory cache for the raw Fuul response.
// Cache is kept even after stale so it can serve as a fallback when Fuul is unreachable.
let rawCache: { data: NormalizedEntry[]; timestamp: number } | null = null

interface FuulLeaderboardEntry {
  address: string
  user_identifier: string
  user_identifier_type: string
  total_amount: number
  total_attributions: number
  rank: number
  affiliate_code?: string
  referred_users?: number
}

interface NormalizedEntry {
  wallet: string
  points: number
  referrals: number
}

/**
 * Fetch a single page from the Fuul leaderboard API with a timeout.
 * Returns null on any failure so the caller can fall back to stale cache.
 */
async function fetchFuulPage(
  fuulApiKey: string,
  page: number
): Promise<{ results: FuulLeaderboardEntry[]; total_results: number } | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FUUL_FETCH_TIMEOUT)

  try {
    const url = new URL(FUUL_LEADERBOARD_URL)
    url.searchParams.set("page", String(page))
    url.searchParams.set("page_size", "100")
    url.searchParams.set("fields", "referred_users")

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${fuulApiKey}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[fuul/leaderboard] Fuul API error (page ${page}):`, response.status, errorText)
      return null
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network"
    console.error(`[fuul/leaderboard] Fuul API ${reason} (page ${page}):`, error)
    return null
  }
}

/**
 * GET /api/fuul/leaderboard?limit=15&page=1&sort=refs|miles
 *
 * Returns miles leaderboard with both sorts pre-computed from a single Fuul API call.
 * Uses stale-while-revalidate caching: serves stale data immediately when Fuul is slow/down.
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

    // Refresh cache if stale or missing
    const isStale = !rawCache || Date.now() - rawCache.timestamp >= LEADERBOARD_CACHE_STALE_TIME
    if (isStale) {
      const allResults: FuulLeaderboardEntry[] = []
      let currentPage = 1
      let failed = false

      // Paginate through all results (max page_size is 100)
      while (!failed) {
        const data = await fetchFuulPage(fuulApiKey, currentPage)
        if (!data) {
          failed = true
          break
        }

        const results = data.results || []
        allResults.push(...results)

        if (allResults.length >= (data.total_results || 0) || results.length === 0) break
        currentPage++
      }

      if (allResults.length > 0) {
        rawCache = {
          data: allResults.map((r) => ({
            wallet: trimWalletAddress(r.address),
            points: Number(r.total_amount) || 0,
            referrals: Number(r.referred_users) || 0,
          })),
          timestamp: Date.now(),
        }
      } else if (rawCache) {
        // Fuul is down but we have stale data — serve it
        console.warn(
          `[fuul/leaderboard] Fuul API unreachable, serving stale cache (age: ${Math.round((Date.now() - rawCache.timestamp) / 1000)}s)`
        )
      } else {
        // No cache at all and Fuul is down
        return NextResponse.json(
          { error: "Miles leaderboard temporarily unavailable" },
          { status: 503 }
        )
      }
    }

    const allEntries = rawCache!.data

    // Paginated mode
    if (page > 0) {
      const sorted =
        sort === "miles"
          ? [...allEntries].sort((a, b) => b.points - a.points)
          : [...allEntries].sort((a, b) => b.referrals - a.referrals)

      const total = sorted.length
      const totalPages = Math.ceil(total / limit)
      const offset = (page - 1) * limit
      const pageEntries = sorted.slice(offset, offset + limit).map((e, i) => ({
        ...e,
        rank: offset + i + 1,
      }))

      const totalMiles = sorted.reduce((sum, e) => sum + e.points, 0)

      return NextResponse.json(
        {
          success: true,
          entries: pageEntries,
          pagination: { page, limit, total, totalPages },
          totalParticipants: total,
          totalMiles,
        },
        {
          headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
        }
      )
    }

    // Non-paginated mode (card preview) — returns both sorts
    return NextResponse.json(buildResponse(allEntries, limit), {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
    })
  } catch (error) {
    console.error("[fuul/leaderboard] Unexpected error:", error)

    // Last resort: serve stale cache even on unexpected errors
    if (rawCache) {
      console.warn("[fuul/leaderboard] Serving stale cache after unexpected error")
      const allEntries = rawCache.data
      const { searchParams } = new URL(request.url)
      const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "15", 10), 1), 100)
      const page = parseInt(searchParams.get("page") || "0", 10)
      const sort = searchParams.get("sort") || ""

      if (page > 0) {
        const sorted =
          sort === "miles"
            ? [...allEntries].sort((a, b) => b.points - a.points)
            : [...allEntries].sort((a, b) => b.referrals - a.referrals)
        const total = sorted.length
        const offset = (page - 1) * limit
        const pageEntries = sorted.slice(offset, offset + limit).map((e, i) => ({
          ...e,
          rank: offset + i + 1,
        }))
        return NextResponse.json({
          success: true,
          entries: pageEntries,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          totalParticipants: total,
          totalMiles: sorted.reduce((sum, e) => sum + e.points, 0),
        })
      }
      return NextResponse.json(buildResponse(allEntries, limit))
    }

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
