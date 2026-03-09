import { NextRequest, NextResponse } from "next/server"
import {
  getLeaderboard,
  getEfficiencyByTxsPerDay,
  getEfficiencyByStreak,
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

interface EfficiencyLeaderEntry {
  rank: number
  wallet: string
  swapCount: number
  activeDays?: number
  txsPerDay?: number
  streak?: number
  volume: number
  volumeEth: number
}

/**
 * GET /api/analytics/leaderboard/efficiency-leaders?sort=tx_count|txs_per_day|streak&limit=15
 *
 * Returns efficiency leader data. Sort determines ordering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get("sort") || "tx_count"
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "15", 10), 1), 100)

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
        swapCount: Number(row[2]) || 0,
        volume: Number(row[3]) || 0,
        volumeEth: Number(row[4]) || 0,
      }))
    } else {
      // "tx_count" — use main leaderboard sorted by swap_count
      const rows = await getLeaderboard(limit)
      const mapped = rows.map((row, i) => ({
        rank: i + 1,
        wallet: trimWalletAddress(String(row[0])),
        swapCount: Number(row[3]) || 0,
        volume: Number(row[2]) || 0,
        volumeEth: Number(row[1]) || 0,
      }))
      // Re-sort by swap count (main leaderboard is sorted by volume)
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
