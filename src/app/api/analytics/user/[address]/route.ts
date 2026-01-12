import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"
import { getEthPrice } from "@/lib/analytics-server"
import { getUserSwapVolume } from "@/lib/analytics/services/users.service"
import { AnalyticsClientError } from "@/lib/analytics/client"

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
    let totalSwapVolEth = 0
    try {
      totalSwapVolEth = await getUserSwapVolume(normalizedAddress)
    } catch (error) {
      // Log error but don't fail the request - return partial data
      if (error instanceof AnalyticsClientError) {
        console.error("Analytics DB API error:", error.message)
      } else {
        console.error("Analytics DB API error:", error)
      }
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
