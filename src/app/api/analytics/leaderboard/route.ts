import { NextRequest, NextResponse } from "next/server"
import { getEthPrice } from "@/lib/analytics-server"
import {
  getLeaderboard,
  getUserLeaderboardData,
  getUserRank,
  getNextRankThreshold,
} from "@/lib/analytics/services/leaderboard.service"
import { AnalyticsClientError } from "@/lib/analytics/client"
import { LEADERBOARD_CACHE_STALE_TIME } from "@/lib/constants"

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
  try {
    // Get current user address from query params (optional)
    const { searchParams } = new URL(request.url)
    const currentUserAddress = searchParams.get("currentUser")?.toLowerCase() || null

    // Check cache first
    const cacheKey = getCacheKey(currentUserAddress)
    const cachedData = getCachedData(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Get main leaderboard (top 15)
    const leaderboardRows = await getLeaderboard(15)

    // Get ETH price for USD conversion
    const ethPrice = await getEthPrice()

    // Format: [wallet, total_swap_vol_eth, swap_count, swap_vol_eth_24h, change_24h_pct]
    let leaderboard = leaderboardRows.map((row, index) => {
      const wallet = row[0]
      const totalSwapVolEth = Number(row[1]) || 0
      const swapCount = Number(row[2]) || 0
      const change24hPct = Number(row[4]) || 0

      // Convert total volume to USD
      const totalSwapVolUsd = ethPrice !== null ? totalSwapVolEth * ethPrice : totalSwapVolEth

      return {
        rank: index + 1,
        wallet: wallet,
        swapVolume24h: totalSwapVolUsd, // Using total volume as the displayed value
        swapCount: swapCount,
        change24h: change24hPct,
        isCurrentUser: currentUserAddress ? wallet === currentUserAddress : false,
      }
    })

    // Find current user's position and add them if not in top 15
    let userPosition: number | null = null
    let userVolume: number | null = null
    let userChange24h: number = 0
    let nextRankVolume: number | null = null

    if (currentUserAddress) {
      const userInLeaderboard = leaderboard.find((entry) => entry.isCurrentUser)
      if (userInLeaderboard) {
        userPosition = userInLeaderboard.rank
        userVolume = userInLeaderboard.swapVolume24h
        userChange24h = userInLeaderboard.change24h
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
          // Fetch user data, rank, and next rank volume in parallel for speed
          const [userData, actualRank, nextRankVolEth] = await Promise.all([
            getUserLeaderboardData(currentUserAddress),
            getUserRank(currentUserAddress),
            getNextRankThreshold(currentUserAddress),
          ])

          if (actualRank !== null && userData && userData[0] > 0) {
            const userTotalSwapVolEth = Number(userData[0]) || 0
            const userSwapCount = Number(userData[1]) || 0
            const userChange24hPct = Number(userData[3]) || 0

            const userTotalSwapVolUsd =
              ethPrice !== null ? userTotalSwapVolEth * ethPrice : userTotalSwapVolEth

            userPosition = actualRank
            userVolume = userTotalSwapVolUsd
            userChange24h = userChange24hPct

            // Find the next rank user's volume (for all positions > 1)
            if (userPosition > 1) {
              if (userPosition <= 15) {
                // User is in top 15, find next rank user from leaderboard
                const nextRankUser = leaderboard.find((entry) => entry.rank === userPosition! - 1)
                if (nextRankUser) {
                  nextRankVolume = nextRankUser.swapVolume24h
                }
              } else if (nextRankVolEth !== null) {
                // User is outside top 15, use the next rank threshold from query
                nextRankVolume = ethPrice !== null ? nextRankVolEth * ethPrice : nextRankVolEth
              }
            }

            // Add current user to leaderboard if not in top 15
            if (userPosition > 15) {
              leaderboard.push({
                rank: userPosition,
                wallet: currentUserAddress,
                swapVolume24h: userTotalSwapVolUsd,
                swapCount: userSwapCount,
                change24h: userChange24hPct,
                isCurrentUser: true,
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
      ethPrice,
    }

    // Cache the response
    setCachedData(cacheKey, responseData)

    return NextResponse.json(responseData)
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
