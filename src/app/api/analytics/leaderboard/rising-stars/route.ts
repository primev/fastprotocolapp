import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getRisingStarsNewUsers,
  getRisingStarsWoWGrowth,
  getRisingStarsClimbers,
  getRisingStarsPaginated,
} from "@/lib/analytics/services/leaderboard.service"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { AnalyticsClientError } from "@/lib/analytics/client"
import { LEADERBOARD_CACHE_STALE_TIME } from "@/lib/config/constants"
import { parseSearchParams } from "@/lib/api/parse"

// page=0 means "card preview"; page≥1 is paginated mode. The three sort
// values map to distinct SQL queries — constraining via z.enum prevents an
// unknown sort from silently falling through to the climbers branch.
const querySchema = z.object({
  sort: z.enum(["climbers", "new_users", "wow_growth"]).default("climbers"),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  page: z.coerce.number().int().min(0).default(0),
})

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
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const { sort, limit, page } = parsed

  try {
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
