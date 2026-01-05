import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"
import { getEthPrice } from "@/lib/analytics-server"

// Validate wallet address format
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params

    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 })
    }

    if (!isValidWalletAddress(address)) {
      return NextResponse.json({ error: "Invalid address format" }, { status: 400 })
    }

    const normalizedAddress = address.toLowerCase()

    // Get transaction counts from FastRPC API
    const fastRpcToken = env.FAST_RPC_API_TOKEN
    if (!fastRpcToken) {
      return NextResponse.json({ error: "Fast RPC API token not configured" }, { status: 500 })
    }

    const fastRpcResponse = await fetch(
      `https://fastrpc.mev-commit.xyz/user-transactions?address=${normalizedAddress}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${fastRpcToken}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!fastRpcResponse.ok) {
      const errorText = await fastRpcResponse.text()
      console.error("FastRPC API error:", errorText)
      return NextResponse.json(
        { error: `FastRPC API returned status ${fastRpcResponse.status}` },
        { status: fastRpcResponse.status }
      )
    }

    const fastRpcData = await fastRpcResponse.json()
    const totalTxs = fastRpcData.txn_count || 0
    const swapTxs = fastRpcData.swap_count || 0

    // Get swap volume from analytics database
    const authToken = env.ANALYTICS_DB_AUTH_TOKEN
    if (!authToken) {
      // Return partial data if analytics DB token is not configured
      return NextResponse.json({
        totalTxs,
        swapTxs,
        totalSwapVolEth: 0,
      })
    }

    // Query for swap volume
    const sqlQuery = `SELECT
      SUM(COALESCE(p.swap_vol_eth, 0)) AS total_swap_vol_eth
    FROM mevcommit_57173.processed_l1_txns_v2 p
    WHERE lower(p.from_address) = lower('${normalizedAddress}')
      AND p.is_swap = TRUE`

    const dbResponse = await fetch(
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

    let totalSwapVolEth = 0

    if (dbResponse.ok) {
      // Parse NDJSON response
      const responseText = await dbResponse.text()
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

      if (dataRows.length > 0 && dataRows[0][0] !== null && dataRows[0][0] !== undefined) {
        totalSwapVolEth = Number(dataRows[0][0]) || 0
      }
    } else {
      // Log error but don't fail the request - return partial data
      const errorText = await dbResponse.text()
      console.error("Analytics DB API error:", errorText)
    }

    const ethPrice = await getEthPrice()

    return NextResponse.json({
      totalTxs,
      swapTxs,
      totalSwapVolEth,
      ethPrice,
    })
  } catch (error) {
    console.error("Error fetching user metrics:", error)
    return NextResponse.json({ error: "Failed to fetch user metrics" }, { status: 500 })
  }
}
