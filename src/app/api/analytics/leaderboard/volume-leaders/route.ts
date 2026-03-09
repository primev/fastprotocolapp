import { NextRequest, NextResponse } from "next/server"
import {
  getLeaderboard,
  getLeaderboardByLargestSwap,
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

interface VolumeLeaderEntry {
  rank: number
  wallet: string
  volume: number
  volumeEth: number
  swapCount: number
  avgSize: number
  largestSwap?: number
  largestSwapEth?: number
}

/**
 * GET /api/analytics/leaderboard/volume-leaders?sort=volume|avg_size|largest&limit=15
 *
 * Returns volume leader data with all metrics. Sort determines ordering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get("sort") || "volume"
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "15", 10), 1), 100)

    const cacheKey = `volume-leaders:${sort}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
      })
    }

    let entries: VolumeLeaderEntry[] = []

    if (sort === "largest") {
      const rows = await getLeaderboardByLargestSwap(limit)
      entries = rows.map((row, i) => ({
        rank: i + 1,
        wallet: trimWalletAddress(String(row[0])),
        volume: Number(row[4]) || 0,
        volumeEth: Number(row[5]) || 0,
        swapCount: Number(row[3]) || 0,
        avgSize: Number(row[3]) > 0 ? (Number(row[4]) || 0) / Number(row[3]) : 0,
        largestSwap: Number(row[1]) || 0,
        largestSwapEth: Number(row[2]) || 0,
      }))
    } else {
      // "volume" and "avg_size" both use the main leaderboard data
      const rows = await getLeaderboard(limit)
      entries = rows.map((row, i) => {
        const volume = Number(row[2]) || 0
        const volumeEth = Number(row[1]) || 0
        const swapCount = Number(row[3]) || 0
        return {
          rank: i + 1,
          wallet: trimWalletAddress(String(row[0])),
          volume,
          volumeEth,
          swapCount,
          avgSize: swapCount > 0 ? volume / swapCount : 0,
        }
      })

      if (sort === "avg_size") {
        entries.sort((a, b) => b.avgSize - a.avgSize)
        entries = entries.map((e, i) => ({ ...e, rank: i + 1 }))
      }
    }

    const responseData = { success: true, entries }
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
    })
  } catch (error) {
    console.error("Error fetching volume leaders:", error)
    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }
    return NextResponse.json({ error: "Failed to fetch volume leaders" }, { status: 500 })
  }
}
