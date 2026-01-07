import { NextResponse } from "next/server"
import { env } from "@/env/server"

export async function GET() {
  try {
    const authToken = env.ANALYTICS_DB_AUTH_TOKEN

    if (!authToken) {
      return NextResponse.json({ error: "Analytics DB auth token not configured" }, { status: 500 })
    }

    const sqlQuery = `WITH base AS (
      SELECT
        sender,
        DATE(FROM_UNIXTIME(1766015999 + (CAST(block_number AS BIGINT) - 24035770) * 12)) AS day_utc
      FROM mctransactions_sr
      WHERE status IN ('confirmed','pre-confirmed')
    ),
    daily AS (
      SELECT
        day_utc,
        COUNT(*) AS successful_txs,
        COUNT(DISTINCT sender) AS unique_senders
      FROM base
      GROUP BY day_utc
    ),
    sender_first AS (
      SELECT sender, MIN(day_utc) AS first_day_utc
      FROM base
      GROUP BY sender
    ),
    new_senders AS (
      SELECT first_day_utc AS day_utc, COUNT(*) AS new_senders
      FROM sender_first
      GROUP BY first_day_utc
    ),
    enriched AS (
      SELECT
        d.day_utc,
        d.successful_txs,
        d.unique_senders,
        SUM(d.successful_txs) OVER (ORDER BY d.day_utc) AS cumulative_successful_txs,
        SUM(COALESCE(n.new_senders, 0)) OVER (ORDER BY d.day_utc) AS cumulative_unique_senders
      FROM daily d
      LEFT JOIN new_senders n
        ON n.day_utc = d.day_utc
    )
    SELECT
      day_utc,
      successful_txs,
      unique_senders,
      cumulative_successful_txs,
      cumulative_unique_senders,
      CASE WHEN day_utc >= DATE '2025-11-20' THEN cumulative_successful_txs ELSE NULL END AS cumulative_successful_txs_chart,
      CASE WHEN day_utc >= DATE '2025-11-20' THEN cumulative_unique_senders ELSE NULL END AS cumulative_unique_senders_chart
    FROM enriched
    ORDER BY day_utc DESC;`

    const response = await fetch(
      "https://analyticsdb.mev-commit.xyz/api/v1/catalogs/pg_mev_commit_fastrpc/databases/public/sql",
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

        // Look for data rows (format: {"data":["2025-12-26",3043,1645,28058,8455,28058,8455]})
        if (parsed.data && Array.isArray(parsed.data)) {
          dataRows.push(parsed.data)
        }
      } catch (lineError) {
        // Skip lines that aren't valid JSON (shouldn't happen, but be safe)
        continue
      }
    }

    if (dataRows.length > 0) {
      // Get the first row (most recent day)
      // Format: [day_utc, successful_txs, unique_senders, cumulative_successful_txs,
      //          cumulative_unique_senders, cumulative_successful_txs_chart, cumulative_unique_senders_chart]
      const latestRow = dataRows[0]

      // Extract cumulative_unique_senders (active traders) from index 4
      // Index 4 is cumulative_unique_senders (always has a value)
      // Index 6 is cumulative_unique_senders_chart (only if date >= 2025-11-20)
      const activeTraders =
        latestRow[4] !== null && latestRow[4] !== undefined
          ? Number(latestRow[4])
          : latestRow[6] !== null && latestRow[6] !== undefined
            ? Number(latestRow[6])
            : null

      if (activeTraders !== null && !isNaN(activeTraders)) {
        return NextResponse.json({
          success: true,
          activeTraders: activeTraders,
        })
      }
    }

    return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
  } catch (error) {
    console.error("Error fetching active traders analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch active traders analytics" },
      { status: 500 }
    )
  }
}

