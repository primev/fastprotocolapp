import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/env/server"
import { getUserSwapVolume } from "@/lib/analytics/services/users.service"
import { AnalyticsClientError } from "@/lib/analytics/client"
import { parseParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const paramsSchema = z.object({ address: walletAddressSchema })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const parsed = await parseParams(params, paramsSchema)
  if (parsed instanceof NextResponse) return parsed
  const normalizedAddress = parsed.address

  try {
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

    // Analytics DB is best-effort — if it's down, we still return tx counts
    // so the UI can render. Zero-volume is a valid fallback.
    let totalSwapVolEth = 0
    let totalSwapVolUsd = 0
    try {
      const vol = await getUserSwapVolume(normalizedAddress)
      totalSwapVolEth = vol.eth
      totalSwapVolUsd = vol.usd
    } catch (error) {
      if (error instanceof AnalyticsClientError) {
        console.error("Analytics DB API error:", error.message)
      } else {
        console.error("Analytics DB API error:", error)
      }
    }

    return NextResponse.json({ totalTxs, swapTxs, totalSwapVolEth, totalSwapVolUsd })
  } catch (error) {
    console.error("Error fetching user metrics:", error)
    return NextResponse.json({ error: "Failed to fetch user metrics" }, { status: 500 })
  }
}
