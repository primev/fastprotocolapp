import { NextRequest, NextResponse } from "next/server"
import {
  getRisingStarsNewUsers,
  getRisingStarsWoWGrowth,
  getRisingStarsClimbers,
  getRisingStarsPaginated,
} from "@/lib/analytics/services/leaderboard.service"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { AnalyticsClientError } from "@/lib/analytics/client"
import { LEADERBOARD_CACHE_STALE_TIME } from "@/lib/constants"

// In-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>()

function getCached(key: string): unknown | null {
  const cached = cache.get(key)
  if (!cached) return null
  if (Date.now() - cached.timestamp > LEADERBOARD_CACHE_STALE_TIME) {
    cache.delete(key)
    return null
  }
  return cached.data
}

interface RisingStarEntry {
  rank: number
  wallet: string
  stat: number
  statLabel: string
  swapCount?: number
  volume?: number
}

/**
 * GET /api/analytics/leaderboard/rising-stars?sort=climbers|new_users|wow_growth&limit=15&page=1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get("sort") || "climbers"
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "15", 10), 1), 100)
    const page = parseInt(searchParams.get("page") || "0", 10)

    // Paginated mode
    if (page > 0) {
      const cacheKey = `rising-stars:${sort}:p${page}:l${limit}`
      const cached = getCached(cacheKey)
      if (cached) {
        return NextResponse.json(cached, {
          headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
        })
      }

      const result = await getRisingStarsPaginated({ sort, page, limit })

      const entries: RisingStarEntry[] = result.entries.map((row, i) => {
        const rank = (page - 1) * limit + i + 1
        if (sort === "new_users") {
          return {
            rank,
            wallet: trimWalletAddress(String(row[0])),
            stat: Number(row[1]) || 0,
            statLabel: "volume",
            swapCount: Number(row[3]) || 0,
            volume: Number(row[1]) || 0,
          }
        }
        if (sort === "wow_growth") {
          return {
            rank,
            wallet: trimWalletAddress(String(row[0])),
            stat: Number(row[3]) || 0,
            statLabel: "growth",
            volume: Number(row[1]) || 0,
          }
        }
        // climbers
        return {
          rank,
          wallet: trimWalletAddress(String(row[0])),
          stat: Number(row[3]) || 0,
          statLabel: "increase",
          volume: Number(row[1]) || 0,
        }
      })

      const responseData = { success: true, entries, pagination: result.pagination }
      cache.set(cacheKey, { data: responseData, timestamp: Date.now() })
      return NextResponse.json(responseData, {
        headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
      })
    }

    // Non-paginated mode (card preview)
    const cacheKey = `rising-stars:${sort}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
      })
    }

    let entries: RisingStarEntry[] = []

    if (sort === "new_users") {
      const rows = await getRisingStarsNewUsers(limit)
      entries = rows.map((row, i) => ({
        rank: i + 1,
        wallet: trimWalletAddress(String(row[0])),
        stat: Number(row[1]) || 0,
        statLabel: "volume",
        swapCount: Number(row[3]) || 0,
        volume: Number(row[1]) || 0,
      }))
    } else if (sort === "wow_growth") {
      const rows = await getRisingStarsWoWGrowth(limit)
      entries = rows.map((row, i) => ({
        rank: i + 1,
        wallet: trimWalletAddress(String(row[0])),
        stat: Number(row[3]) || 0,
        statLabel: "growth",
        volume: Number(row[1]) || 0,
      }))
    } else {
      const rows = await getRisingStarsClimbers(limit)
      entries = rows.map((row, i) => ({
        rank: i + 1,
        wallet: trimWalletAddress(String(row[0])),
        stat: Number(row[3]) || 0,
        statLabel: "increase",
        volume: Number(row[1]) || 0,
      }))
    }

    const responseData = { success: true, entries }
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
    })
  } catch (error) {
    console.error("Error fetching rising stars:", error)
    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }
    return NextResponse.json({ error: "Failed to fetch rising stars" }, { status: 500 })
  }
}
