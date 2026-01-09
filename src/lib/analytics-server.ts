import { env } from "@/env/server"

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
 * Calls the internal API route which handles the external API call
 */
export async function getActiveTraders(): Promise<number | null> {
  try {
    // Call the internal API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/analytics/active-traders`, {
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("Failed to fetch active traders:", response.statusText)
      return null
    }

    const data = await response.json()

    if (data.success && data.activeTraders !== null && data.activeTraders !== undefined) {
      return Number(data.activeTraders)
    }

    return null
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
  }>
  ethPrice: number | null
} | null> {
  try {
    const authToken = env.ANALYTICS_DB_AUTH_TOKEN

    if (!authToken) {
      console.error("Analytics DB auth token not configured")
      return null
    }

    // Query: Get top 15 by total swap volume
    const sqlQuery = `WITH all_time AS (
      SELECT 
        lower(from_address) AS wallet,
        SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
        COUNT(*) AS swap_count
      FROM mevcommit_57173.processed_l1_txns_v2
      WHERE is_swap = TRUE
      GROUP BY lower(from_address)
    ),
    current_24h AS (
      SELECT 
        lower(from_address) AS wallet,
        SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_24h
      FROM mevcommit_57173.processed_l1_txns_v2
      WHERE is_swap = TRUE
        AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
      GROUP BY lower(from_address)
    ),
    previous_24h AS (
      SELECT 
        lower(from_address) AS wallet,
        SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_prev_24h
      FROM mevcommit_57173.processed_l1_txns_v2
      WHERE is_swap = TRUE
        AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '2' DAY
        AND l1_timestamp < date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
      GROUP BY lower(from_address)
    )
    SELECT 
      a.wallet,
      COALESCE(a.total_swap_vol_eth, 0) AS total_swap_vol_eth,
      COALESCE(a.swap_count, 0) AS swap_count,
      COALESCE(c.swap_vol_eth_24h, 0) AS swap_vol_eth_24h,
      CASE 
        WHEN COALESCE(p.swap_vol_eth_prev_24h, 0) > 0 
        THEN ((COALESCE(c.swap_vol_eth_24h, 0) - COALESCE(p.swap_vol_eth_prev_24h, 0)) / p.swap_vol_eth_prev_24h * 100)
        WHEN COALESCE(c.swap_vol_eth_24h, 0) > 0 AND COALESCE(p.swap_vol_eth_prev_24h, 0) = 0
        THEN 100
        ELSE 0
      END AS change_24h_pct
    FROM all_time a
    LEFT JOIN current_24h c ON a.wallet = c.wallet
    LEFT JOIN previous_24h p ON a.wallet = p.wallet
    WHERE COALESCE(a.total_swap_vol_eth, 0) > 0
    ORDER BY a.total_swap_vol_eth DESC
    LIMIT 15;`

    const response = await fetch(
      "https://analyticsdb.mev-commit.xyz/api/v1/catalogs/default_catalog/databases/mev_commit_8855/sql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authToken}`,
        },
        body: JSON.stringify({ query: sqlQuery }),
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Analytics API error:", errorText)
      return null
    }

    // Parse NDJSON response
    const responseText = await response.text()
    const lines = responseText.trim().split("\n")
    const dataRows: any[] = []

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const parsed = JSON.parse(line)
        if (parsed.data && Array.isArray(parsed.data)) {
          dataRows.push(parsed.data)
        }
      } catch (lineError) {
        continue
      }
    }

    // Get ETH price for USD conversion
    const ethPrice = await getEthPrice()

    // Format leaderboard
    const leaderboard = dataRows.map((row, index) => {
      const wallet = row[0]
      const totalSwapVolEth = Number(row[1]) || 0
      const swapCount = Number(row[2]) || 0
      const change24hPct = Number(row[4]) || 0

      // Convert total volume to USD
      const totalSwapVolUsd = ethPrice !== null ? totalSwapVolEth * ethPrice : totalSwapVolEth

      return {
        rank: index + 1,
        wallet: wallet,
        swapVolume24h: totalSwapVolUsd,
        swapCount: swapCount,
        change24h: change24hPct,
        isCurrentUser: false, // Will be set client-side if needed
      }
    })

    return {
      leaderboard,
      ethPrice,
    }
  } catch (error) {
    console.error("Error fetching leaderboard top 15:", error)
    return null
  }
}
