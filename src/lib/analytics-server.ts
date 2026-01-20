import { env } from "@/env/server"
import { getLeaderboard } from "@/lib/analytics/services/leaderboard.service"
import { transformLeaderboardRows } from "@/lib/analytics/services/leaderboard-transform"
import { getActiveTraders as getActiveTradersService } from "@/lib/analytics/services/transactions.service"

/**
 * Server-side function to fetch cumulative successful transactions from analytics API
 * Calls the internal API route which handles the external API call
 */
export async function getCumulativeTransactions(): Promise<number | null> {
  try {
    // Call the internal API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/analytics/transactions`, {
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("Failed to fetch transactions:", response.statusText)
      return null
    }

    const data = await response.json()

    if (data.success && data.cumulativeSuccessfulTxs !== null) {
      return Number(data.cumulativeSuccessfulTxs)
    }

    return null
  } catch (error) {
    console.error("Error fetching cumulative transactions:", error)
    return null
  }
}

/**
 * Server-side function to fetch current ETH price from Alchemy
 */
export async function getEthPrice(): Promise<number | null> {
  try {
    const apiKey = env.ALCHEMY_API_KEY

    if (!apiKey) {
      console.error("ALCHEMY_API_KEY not configured")
      return null
    }

    const response = await fetch(
      `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-symbol?symbols=ETH`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Failed to fetch ETH price:", response.status, errorText)
      return null
    }

    const data = await response.json()

    // Alchemy returns data in format:
    // {
    //   "data": [
    //     {
    //       "symbol": "ETH",
    //       "prices": [
    //         {
    //           "currency": "usd",
    //           "value": "2933.1463611734",
    //           "lastUpdatedAt": "2025-12-29T16:38:25Z"
    //         }
    //       ]
    //     }
    //   ]
    // }
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const ethData = data.data.find((item: any) => item.symbol === "ETH")
      if (ethData && ethData.prices && Array.isArray(ethData.prices) && ethData.prices.length > 0) {
        const usdPrice = ethData.prices.find((price: any) => price.currency === "usd")
        if (usdPrice && usdPrice.value) {
          return Number(usdPrice.value)
        }
      }
    }

    return null
  } catch (error) {
    console.error("Error fetching ETH price:", error)
    return null
  }
}

/**
 * Server-side function to fetch token price from Alchemy by symbol
 */
export async function getTokenPrice(symbol: string): Promise<number | null> {
  try {
    const apiKey = env.ALCHEMY_API_KEY

    if (!apiKey) {
      console.error("ALCHEMY_API_KEY not configured")
      return null
    }

    if (!symbol) {
      return null
    }

    const response = await fetch(
      `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-symbol?symbols=${encodeURIComponent(symbol.toUpperCase())}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to fetch ${symbol} price:`, response.status, errorText)
      return null
    }

    const data = await response.json()

    // Alchemy returns data in format:
    // {
    //   "data": [
    //     {
    //       "symbol": "USDC",
    //       "prices": [
    //         {
    //           "currency": "usd",
    //           "value": "1.0001",
    //           "lastUpdatedAt": "2025-12-29T16:38:25Z"
    //         }
    //       ]
    //     }
    //   ]
    // }
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const tokenData = data.data.find((item: any) => item.symbol.toUpperCase() === symbol.toUpperCase())
      if (tokenData && tokenData.prices && Array.isArray(tokenData.prices) && tokenData.prices.length > 0) {
        const usdPrice = tokenData.prices.find((price: any) => price.currency === "usd")
        if (usdPrice && usdPrice.value) {
          return Number(usdPrice.value)
        }
      }
    }

    return null
  } catch (error) {
    console.error(`Error fetching ${symbol} price:`, error)
    return null
  }
}

/**
 * Server-side function to fetch cumulative swap volume from analytics API
 * Calls the internal API route which handles the external API call
 */
export async function getCumulativeSwapVolume(): Promise<number | null> {
  try {
    // Call the internal API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/analytics/volume/swap`, {
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("Failed to fetch swap volume:", response.statusText)
      return null
    }

    const data = await response.json()

    if (data.success && data.cumulativeSwapVolEth !== null) {
      return Number(data.cumulativeSwapVolEth)
    }

    return null
  } catch (error) {
    console.error("Error fetching cumulative swap volume:", error)
    return null
  }
}

/**
 * Server-side function to fetch global swap transaction count from analytics API
 * Calls the internal API route which handles the external API call
 */
export async function getSwapTransactionCount(): Promise<number | null> {
  try {
    // Call the internal API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/analytics/swap-count`, {
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("Failed to fetch swap count:", response.statusText)
      return null
    }

    const data = await response.json()

    if (data.success && data.swapTxCount !== null && data.swapTxCount !== undefined) {
      return Number(data.swapTxCount)
    }

    return null
  } catch (error) {
    console.error("Error fetching swap transaction count:", error)
    return null
  }
}

/**
 * Server-side function to fetch total points earned from Fuul payout summary
 * Calls the internal API route which handles the external API call
 */
export async function getTotalPointsEarned(): Promise<number | null> {
  try {
    // Call the internal API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/fuul/payouts-summary?currency=point`, {
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("Failed to fetch payout summary:", response.statusText)
      return null
    }

    const data = await response.json()

    if (
      data.success &&
      data.data &&
      data.data.total_payouts !== null &&
      data.data.total_payouts !== undefined
    ) {
      return Number(data.data.total_payouts)
    }

    return null
  } catch (error) {
    console.error("Error fetching total points earned:", error)
    return null
  }
}

/**
 * Server-side function to fetch active traders count from analytics API
 * Calls the service directly instead of HTTP to avoid issues on Vercel
 */
export async function getActiveTraders(): Promise<number | null> {
  try {
    // Call the service directly instead of making HTTP request
    // This avoids issues with self-referencing URLs on Vercel
    const activeTraders = await getActiveTradersService({
      catalog: "fastrpc",
    })

    return activeTraders
  } catch (error) {
    console.error("Error fetching active traders:", error)
    return null
  }
}

/**
 * Server-side function to fetch leaderboard data (top 15) without user-specific data
 * This can be used for SSR to show the leaderboard immediately
 */
export async function getLeaderboardTop15(): Promise<{
  leaderboard: Array<{
    rank: number
    wallet: string
    swapVolume24h: number
    swapCount: number
    change24h: number
    isCurrentUser: boolean
    ethValue: number
  }>
  ethPrice: number | null
} | null> {
  try {
    // Get ETH price for USD conversion
    const ethPrice = await getEthPrice()

    // Use the SQL flow via leaderboard service
    const leaderboardRows = await getLeaderboard(15)

    // Transform to expected format with USD conversion using shared utility
    // useTotalVolume=false means we use swap_vol_eth_24h (24h volume) for SSR
    const leaderboard = transformLeaderboardRows(
      leaderboardRows,
      ethPrice,
      null, // No current user for SSR
      false // Use 24h volume for SSR
    )

    return {
      leaderboard,
      ethPrice,
    }
  } catch (error) {
    console.error("Error fetching leaderboard top 15:", error)
    return null
  }
}
