import { NextResponse } from "next/server"
import { env } from "@/env/server"

export async function GET() {
  try {
    const authToken = env.ANALYTICS_DB_AUTH_TOKEN

    if (!authToken) {
      return NextResponse.json({ error: "Analytics DB auth token not configured" }, { status: 500 })
    }

    const sqlQuery = `WITH daily AS (
      SELECT
        date_trunc('day', l1_timestamp) AS day,
        SUM(COALESCE(total_vol_eth, 0)) AS daily_total_tx_vol_eth,
        SUM(COALESCE(swap_vol_eth, 0))  AS daily_total_swap_vol_eth
      FROM mevcommit_57173.processed_l1_txns_v2
      GROUP BY 1
    ),
    cumulative AS (
      SELECT
        CAST(day AS VARCHAR) AS day,
        SUM(daily_total_tx_vol_eth) OVER (
          ORDER BY day ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_total_tx_vol_eth,
        SUM(daily_total_swap_vol_eth) OVER (
          ORDER BY day ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_total_swap_vol_eth
      FROM daily
    )
    SELECT
      day,
      cumulative_total_tx_vol_eth,
      cumulative_total_swap_vol_eth
    FROM cumulative
    WHERE CAST(day AS DATE) >= DATE '2025-11-20'
    ORDER BY day DESC;`

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
      return NextResponse.json(
        { error: `Analytics API returned status ${response.status}` },
        { status: response.status }
      )
    }

    // Get the raw response text - it's NDJSON (newline-delimited JSON)
    const responseText = await response.text()

    // Parse NDJSON format - each line is a separate JSON object
    const lines = responseText.trim().split("\n")
    const dataRows: any[] = []

    // Parse each line as JSON
    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const parsed = JSON.parse(line)

        // Look for data rows (format: {"data":["2025-12-26",1234.56,567.89]})
        if (parsed.data && Array.isArray(parsed.data)) {
          dataRows.push(parsed.data)
        }
      } catch (lineError) {
        // Skip lines that aren't valid JSON (shouldn't happen, but be safe)
        continue
      }
    }

    if (dataRows.length > 0) {
      // Get the first row (most recent day) - the query already orders by day DESC
      // Format: [day, cumulative_total_tx_vol_eth, cumulative_total_swap_vol_eth]
      const latestRow = dataRows[0]

      // Extract cumulative_total_tx_vol_eth from index 1
      const cumulativeVolume =
        latestRow[1] !== null && latestRow[1] !== undefined ? Number(latestRow[1]) : null

      if (cumulativeVolume !== null && !isNaN(cumulativeVolume)) {
        return NextResponse.json({
          success: true,
          cumulativeTotalTxVolEth: cumulativeVolume,
        })
      }
    }

    return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
  } catch (error) {
    console.error("Error fetching transaction volume analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch transaction volume analytics" },
      { status: 500 }
    )
  }
}
