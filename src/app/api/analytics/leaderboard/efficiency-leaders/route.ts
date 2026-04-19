import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getLeaderboard,
  getEfficiencyByTxsPerDay,
  getEfficiencyByStreak,
  getEfficiencyLeadersPaginated,
} from "@/lib/analytics/services/leaderboard.service"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { AnalyticsClientError } from "@/lib/analytics/client"
import { LEADERBOARD_CACHE_STALE_TIME } from "@/lib/config/constants"
import { parseSearchParams } from "@/lib/api/parse"

// page=0 means "card preview"; page≥1 is paginated mode. We keep the split
// because the UI relies on it. Tier defaults to "all"; sort defaults to
// tx_count and is constrained to the three supported values so an unknown
// sort doesn't silently fall through to the tx_count branch.
const querySchema = z.object({
  sort: z.enum(["tx_count", "txs_per_day", "streak"]).default("tx_count"),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  tier: z.string().default("all"),
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

interface EfficiencyLeaderEntry {
  rank: number
  wallet: string
  swapCount: number
  activeDays?: number
  txsPerDay?: number
  streak?: number
  currentStreak?: number
  volume: number
  volumeEth: number
}

/**
 * GET /api/analytics/leaderboard/efficiency-leaders?sort=tx_count|txs_per_day|streak&limit=15&tier=all&page=1
 */
export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const { sort, limit, tier, page } = parsed

  try {
    // Paginated mode
    if (page > 0) {
      const cacheKey = `efficiency-leaders:${sort}:${tier}:p${page}:l${limit}`
      const cached = getCached(cacheKey)
      if (cached) {
        return NextResponse.json(cached, {
          headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
        })
      }

      const result = await getEfficiencyLeadersPaginated({ sort, tier, page, limit })

      const entries: EfficiencyLeaderEntry[] = result.entries.map((row, i) => {
        if (sort === "txs_per_day") {
          return {
            rank: (page - 1) * limit + i + 1,
            wallet: trimWalletAddress(String(row[0])),
            swapCount: Number(row[1]) || 0,
            activeDays: Number(row[2]) || 0,
            txsPerDay: Number(row[3]) || 0,
            volume: Number(row[4]) || 0,
            volumeEth: Number(row[5]) || 0,
          }
        }
        if (sort === "streak") {
          return {
            rank: (page - 1) * limit + i + 1,
            wallet: trimWalletAddress(String(row[0])),
            streak: Number(row[1]) || 0,
            currentStreak: Number(row[2]) || 0,
            swapCount: 0,
            volume: 0,
            volumeEth: 0,
          }
        }
        // tx_count
        return {
          rank: (page - 1) * limit + i + 1,
          wallet: trimWalletAddress(String(row[0])),
          swapCount: Number(row[3]) || 0,
          volume: Number(row[2]) || 0,
          volumeEth: Number(row[1]) || 0,
        }
      })

      const responseData = { success: true, entries, pagination: result.pagination }
      cache.set(cacheKey, { data: responseData, timestamp: Date.now() })
      return NextResponse.json(responseData, {
        headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
      })
    }

    // Non-paginated mode (card preview)
    const cacheKey = `efficiency-leaders:${sort}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
      })
    }

    let entries: EfficiencyLeaderEntry[] = []

    if (sort === "txs_per_day") {
      const rows = await getEfficiencyByTxsPerDay(limit)
      entries = rows.map((row, i) => ({
        rank: i + 1,
        wallet: trimWalletAddress(String(row[0])),
        swapCount: Number(row[1]) || 0,
        activeDays: Number(row[2]) || 0,
        txsPerDay: Number(row[3]) || 0,
        volume: Number(row[4]) || 0,
        volumeEth: Number(row[5]) || 0,
      }))
    } else if (sort === "streak") {
      const rows = await getEfficiencyByStreak(limit)
      entries = rows.map((row, i) => ({
        rank: i + 1,
        wallet: trimWalletAddress(String(row[0])),
        streak: Number(row[1]) || 0,
        currentStreak: Number(row[2]) || 0,
        swapCount: 0,
        volume: 0,
        volumeEth: 0,
      }))
    } else {
      const rows = await getLeaderboard(limit)
      const mapped = rows.map((row, i) => ({
        rank: i + 1,
        wallet: trimWalletAddress(String(row[0])),
        swapCount: Number(row[3]) || 0,
        volume: Number(row[2]) || 0,
        volumeEth: Number(row[1]) || 0,
      }))
      mapped.sort((a, b) => b.swapCount - a.swapCount)
      entries = mapped.map((e, i) => ({ ...e, rank: i + 1 }))
    }

    const responseData = { success: true, entries }
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
    })
  } catch (error) {
    console.error("Error fetching efficiency leaders:", error)
    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }
    return NextResponse.json({ error: "Failed to fetch efficiency leaders" }, { status: 500 })
  }
}
