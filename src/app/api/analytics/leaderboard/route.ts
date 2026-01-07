import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"
import { getEthPrice } from "@/lib/analytics-server"

export async function GET(request: NextRequest) {
  try {
    const authToken = env.ANALYTICS_DB_AUTH_TOKEN

    if (!authToken) {
      return NextResponse.json({ error: "Analytics DB auth token not configured" }, { status: 500 })
    }

    // Get current user address from query params (optional)
    const { searchParams } = new URL(request.url)
    const currentUserAddress = searchParams.get("currentUser")?.toLowerCase()

    // Query: Rank by total swap volume, calculate 24h change
    // Using date_trunc approach similar to volume/swap route for Trino compatibility
    const sqlQuery = `WITH all_time AS (
      SELECT 
        lower(from_address) AS wallet,
        SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
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
      COALESCE(c.swap_vol_eth_24h, 0) AS swap_vol_eth_24h,
      CASE 
        WHEN COALESCE(p.swap_vol_eth_prev_24h, 0) > 0 
        THEN ((COALESCE(c.swap_vol_eth_24h, 0) - COALESCE(p.swap_vol_eth_prev_24h, 0)) / p.swap_vol_eth_prev_24h * 100)
        WHEN COALESCE(c.swap_vol_eth_24h, 0) > 0 AND COALESCE(p.swap_vol_eth_prev_24h, 0) = 0
        THEN 100  -- New activity
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
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Analytics API error:", errorText)
      console.error("SQL Query that failed:", sqlQuery)
      return NextResponse.json(
        { 
          error: `Analytics API returned status ${response.status}`,
          details: errorText,
          query: sqlQuery 
        },
        { status: response.status }
      )
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

    // Format: [wallet, total_swap_vol_eth, swap_vol_eth_24h, change_24h_pct]
    let leaderboard = dataRows.map((row, index) => {
      const wallet = row[0]
      const totalSwapVolEth = Number(row[1]) || 0
      const change24hPct = Number(row[3]) || 0

      // Convert total volume to USD
      const totalSwapVolUsd = ethPrice !== null ? totalSwapVolEth * ethPrice : totalSwapVolEth

      return {
        rank: index + 1,
        wallet: wallet,
        swapVolume24h: totalSwapVolUsd, // Using total volume as the displayed value
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
          const nextRankUser = leaderboard.find((entry) => entry.rank === userPosition - 1)
          if (nextRankUser) {
            nextRankVolume = nextRankUser.swapVolume24h
          }
        }
      } else {
        // Fetch user's data separately to add them to the leaderboard
        // First, get the user's volume and 24h change data
        const userDataQuery = `WITH all_time_user AS (
          SELECT 
            SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
          FROM mevcommit_57173.processed_l1_txns_v2
          WHERE is_swap = TRUE
            AND lower(from_address) = lower('${currentUserAddress}')
        ),
        current_24h_user AS (
          SELECT 
            SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_24h
          FROM mevcommit_57173.processed_l1_txns_v2
          WHERE is_swap = TRUE
            AND lower(from_address) = lower('${currentUserAddress}')
            AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
        ),
        previous_24h_user AS (
          SELECT 
            SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_prev_24h
          FROM mevcommit_57173.processed_l1_txns_v2
          WHERE is_swap = TRUE
            AND lower(from_address) = lower('${currentUserAddress}')
            AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '2' DAY
            AND l1_timestamp < date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
        )
        SELECT 
          COALESCE(a.total_swap_vol_eth, 0) AS total_swap_vol_eth,
          COALESCE(c.swap_vol_eth_24h, 0) AS swap_vol_eth_24h,
          CASE 
            WHEN COALESCE(p.swap_vol_eth_prev_24h, 0) > 0 
            THEN ((COALESCE(c.swap_vol_eth_24h, 0) - COALESCE(p.swap_vol_eth_prev_24h, 0)) / p.swap_vol_eth_prev_24h * 100)
            WHEN COALESCE(c.swap_vol_eth_24h, 0) > 0 AND COALESCE(p.swap_vol_eth_prev_24h, 0) = 0
            THEN 100
            ELSE 0
          END AS change_24h_pct
        FROM all_time_user a
        LEFT JOIN current_24h_user c ON 1=1
        LEFT JOIN previous_24h_user p ON 1=1`

        // Then, get the user's actual rank by counting all users with higher volume
        const userRankQuery = `SELECT COUNT(*) + 1 AS user_rank
        FROM (
          SELECT 
            lower(from_address) AS wallet,
            SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
          FROM mevcommit_57173.processed_l1_txns_v2
          WHERE is_swap = TRUE
          GROUP BY lower(from_address)
          HAVING SUM(COALESCE(swap_vol_eth, 0)) > (
            SELECT SUM(COALESCE(swap_vol_eth, 0))
            FROM mevcommit_57173.processed_l1_txns_v2
            WHERE is_swap = TRUE
              AND lower(from_address) = lower('${currentUserAddress}')
          )
        ) higher_volumes`

        try {
          // Fetch user data and rank in parallel
          const [userDataResponse, userRankResponse] = await Promise.all([
            fetch(
              "https://analyticsdb.mev-commit.xyz/api/v1/catalogs/default_catalog/databases/mev_commit_8855/sql",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Basic ${authToken}`,
                },
                body: JSON.stringify({ query: userDataQuery }),
              }
            ),
            fetch(
              "https://analyticsdb.mev-commit.xyz/api/v1/catalogs/default_catalog/databases/mev_commit_8855/sql",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Basic ${authToken}`,
                },
                body: JSON.stringify({ query: userRankQuery }),
              }
            ),
          ])

          if (userDataResponse.ok && userRankResponse.ok) {
            // Parse user data
            const userDataText = await userDataResponse.text()
            const userRankText = await userRankResponse.text()
            
            let userTotalSwapVolEth = 0
            let userChange24hPct = 0
            let actualRank: number | null = null

            // Parse user data
            const userDataLines = userDataText.trim().split("\n")
            for (const line of userDataLines) {
              if (!line.trim()) continue
              try {
                const parsed = JSON.parse(line)
                if (parsed.data && Array.isArray(parsed.data) && parsed.data[0] !== null) {
                  userTotalSwapVolEth = Number(parsed.data[0]) || 0
                  userChange24hPct = Number(parsed.data[2]) || 0
                  break
                }
              } catch (e) {
                continue
              }
            }

            // Parse user rank
            const userRankLines = userRankText.trim().split("\n")
            for (const line of userRankLines) {
              if (!line.trim()) continue
              try {
                const parsed = JSON.parse(line)
                if (parsed.data && Array.isArray(parsed.data) && parsed.data[0] !== null) {
                  actualRank = Number(parsed.data[0]) || null
                  break
                }
              } catch (e) {
                continue
              }
            }

            if (actualRank !== null && userTotalSwapVolEth > 0) {
              const userTotalSwapVolUsd =
                ethPrice !== null ? userTotalSwapVolEth * ethPrice : userTotalSwapVolEth

              userPosition = actualRank
              userVolume = userTotalSwapVolUsd
              userChange24h = userChange24hPct

              // Find the next rank user's volume (for all positions > 1)
              if (userPosition > 1) {
                if (userPosition <= 15) {
                  // User is in top 15, find next rank user from leaderboard
                  const nextRankUser = leaderboard.find((entry) => entry.rank === userPosition - 1)
                  if (nextRankUser) {
                    nextRankVolume = nextRankUser.swapVolume24h
                  }
                } else {
                  // User is outside top 15, query for the user at position (userPosition - 1)
                  const nextRankQuery = `WITH ranked_users AS (
                    SELECT 
                      lower(from_address) AS wallet,
                      SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
                      ROW_NUMBER() OVER (ORDER BY SUM(COALESCE(swap_vol_eth, 0)) DESC) AS rank_position
                    FROM mevcommit_57173.processed_l1_txns_v2
                    WHERE is_swap = TRUE
                    GROUP BY lower(from_address)
                    HAVING SUM(COALESCE(swap_vol_eth, 0)) > 0
                  )
                  SELECT total_swap_vol_eth
                  FROM ranked_users
                  WHERE rank_position = ${userPosition - 1}
                  LIMIT 1`

                  try {
                    const nextRankResponse = await fetch(
                      "https://analyticsdb.mev-commit.xyz/api/v1/catalogs/default_catalog/databases/mev_commit_8855/sql",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Basic ${authToken}`,
                        },
                        body: JSON.stringify({ query: nextRankQuery }),
                      }
                    )

                    if (nextRankResponse.ok) {
                      const nextRankText = await nextRankResponse.text()
                      const nextRankLines = nextRankText.trim().split("\n")
                      for (const line of nextRankLines) {
                        if (!line.trim()) continue
                        try {
                          const parsed = JSON.parse(line)
                          if (parsed.data && Array.isArray(parsed.data) && parsed.data[0] !== null) {
                            const nextRankVolEth = Number(parsed.data[0]) || 0
                            if (nextRankVolEth > 0) {
                              nextRankVolume = ethPrice !== null ? nextRankVolEth * ethPrice : nextRankVolEth
                              console.log(`Next rank volume for position ${userPosition - 1}: ${nextRankVolume} USD (${nextRankVolEth} ETH)`)
                            }
                            break
                          }
                        } catch (e) {
                          continue
                        }
                      }
                    } else {
                      const errorText = await nextRankResponse.text()
                      console.error("Error fetching next rank volume:", nextRankResponse.status, errorText)
                    }
                  } catch (error) {
                    console.error("Error fetching next rank volume:", error)
                  }
                }
              }

              // Add current user to leaderboard if not in top 15
              if (userPosition > 15) {
                leaderboard.push({
                  rank: userPosition,
                  wallet: currentUserAddress,
                  swapVolume24h: userTotalSwapVolUsd,
                  change24h: userChange24hPct,
                  isCurrentUser: true,
                })
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user position:", error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      leaderboard,
      userPosition,
      userVolume,
      nextRankVolume,
      ethPrice,
    })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { 
        error: "Failed to fetch leaderboard",
        details: errorMessage,
        stack: errorStack 
      },
      { status: 500 }
    )
  }
}

