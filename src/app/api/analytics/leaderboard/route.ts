import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getLeaderboard,
  getUserLeaderboardData,
  getUserRank,
  getNextRankThreshold,
} from "@/lib/analytics/services/leaderboard.service"
import {
  transformLeaderboardRows,
  trimWalletAddress,
} from "@/lib/analytics/services/leaderboard-transform"
import { AnalyticsClientError } from "@/lib/analytics/client"
import { LEADERBOARD_CACHE_STALE_TIME } from "@/lib/config/constants"
import { parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

// `currentUser` is optional; when present the leaderboard response includes
// the caller's rank + change. Wallet is lower-cased by walletAddressSchema.
const querySchema = z.object({
  currentUser: walletAddressSchema.optional(),
})

// In-memory cache for leaderboard data
const cache = new Map<string, { data: any; timestamp: number }>()

// Helper function to get cache key
function getCacheKey(currentUserAddress: string | null): string {
  return `leaderboard:${currentUserAddress || "all"}`
}

// Helper function to get cached data
function getCachedData(key: string): any | null {
  const cached = cache.get(key)
  if (!cached) return null

  const now = Date.now()
  if (now - cached.timestamp > LEADERBOARD_CACHE_STALE_TIME) {
    cache.delete(key)
    return null
  }

  return cached.data
}

// Helper function to set cached data
function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  // Wallet is already lower-cased by walletAddressSchema; null marks the
  // "unauthenticated leaderboard request" branch throughout this handler.
  const currentUserAddress = parsed.currentUser ?? null

  try {
    // Check cache first
    const cacheKey = getCacheKey(currentUserAddress)
    const cachedData = getCachedData(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Get main leaderboard (top 100 for client-side tier filtering)
    const leaderboardRows = await getLeaderboard(100)

    // Transform leaderboard rows (USD from DB columns)
    // useTotalVolume=true means we use total_swap_vol_usd
    const leaderboard = transformLeaderboardRows(
      leaderboardRows,
      currentUserAddress,
      true // Use total volume
    )

    // Find current user's position and add them if not in top 15
    let userPosition: number | null = null
    let userVolume: number | null = null
    let nextRankVolume: number | null = null

    if (currentUserAddress) {
      const userInLeaderboard = leaderboard.find((entry) => entry.isCurrentUser)
      if (userInLeaderboard) {
        userPosition = userInLeaderboard.rank
        userVolume = userInLeaderboard.swapVolume24h
        // Find next rank user from leaderboard if user is not #1
        if (userPosition > 1) {
          const nextRankUser = leaderboard.find((entry) => entry.rank === userPosition! - 1)
          if (nextRankUser) {
            nextRankVolume = nextRankUser.swapVolume24h
          }
        }
      } else {
        // Fetch user's data separately to add them to the leaderboard
        try {
          const [userData, actualRank, nextRankThreshold] = await Promise.all([
            getUserLeaderboardData(currentUserAddress),
            getUserRank(currentUserAddress),
            getNextRankThreshold(currentUserAddress),
          ])

          if (actualRank !== null && userData && userData[0] > 0) {
            const userTotalSwapVolEth = Number(userData[0]) || 0
            const userTotalSwapVolUsd = Number(userData[1]) || 0
            const userSwapCount = Number(userData[2]) || 0
            const userChange24hPct = Number(userData[5]) || 0

            userPosition = actualRank
            userVolume = userTotalSwapVolUsd

            if (userPosition > 1) {
              if (userPosition <= 15) {
                const nextRankUser = leaderboard.find((entry) => entry.rank === userPosition! - 1)
                if (nextRankUser) {
                  nextRankVolume = nextRankUser.swapVolume24h
                }
              } else if (nextRankThreshold.usd !== null) {
                nextRankVolume = nextRankThreshold.usd
              }
            }

            if (userPosition > 15 && currentUserAddress) {
              leaderboard.push({
                rank: userPosition,
                wallet: trimWalletAddress(currentUserAddress.toLowerCase()),
                swapVolume24h: userTotalSwapVolUsd,
                swapCount: userSwapCount,
                change24h: userChange24hPct,
                isCurrentUser: true,
                ethValue: userTotalSwapVolEth,
              })
            }
          }
        } catch (error) {
          console.error("Error fetching user position:", error)
          // Continue without user-specific data rather than failing the entire request
        }
      }
    }

    const responseData = {
      success: true,
      leaderboard,
      userPosition,
      userVolume,
      nextRankVolume,
    }

    // Cache the response
    setCachedData(cacheKey, responseData)

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5",
      },
    })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      {
        error: "Failed to fetch leaderboard",
        details: errorMessage,
        stack: errorStack,
      },
      { status: 500 }
    )
  }
}
