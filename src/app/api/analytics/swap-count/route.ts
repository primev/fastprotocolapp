import { NextResponse } from "next/server"
import { env } from "@/env/server"

export async function GET() {
  try {
    const authToken = env.ANALYTICS_DB_AUTH_TOKEN

    if (!authToken) {
      return NextResponse.json({ error: "Analytics DB auth token not configured" }, { status: 500 })
    }

    // Query for global swap transaction count (not filtered by address)
    // This query ensures swaps exist in the FastRPC transactions table
    const sqlQuery = `SELECT
      COUNT(*) AS swap_tx_count,
      SUM(COALESCE(p.swap_vol_eth, 0)) AS total_swap_vol_eth
    FROM mevcommit_57173.processed_l1_txns_v2 p
    WHERE p.is_swap = TRUE
      AND EXISTS (
        SELECT 1
        FROM pg_mev_commit_fastrpc.public.mctransactions_sr m
        WHERE lower(m.hash) = concat('0x', lower(p.l1_tx_hash))
      )`

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

    if (dataRows.length > 0) {
      // Format: [swap_tx_count, total_swap_vol_eth]
      const row = dataRows[0]
      const swapTxCount =
        row[0] !== null && row[0] !== undefined ? Number(row[0]) : null

      if (swapTxCount !== null && !isNaN(swapTxCount)) {
        return NextResponse.json({
          success: true,
          swapTxCount: swapTxCount,
        })
      }
    }

    return NextResponse.json({ error: "No data returned from analytics API" }, { status: 500 })
  } catch (error) {
    console.error("Error fetching swap count:", error)
    return NextResponse.json({ error: "Failed to fetch swap count" }, { status: 500 })
  }
}

