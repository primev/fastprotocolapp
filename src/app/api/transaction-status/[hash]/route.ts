import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await params

    if (!hash) {
      return NextResponse.json(
        { success: false, error: "Transaction hash is required" },
        { status: 400 }
      )
    }

    const apiToken = env.FAST_RPC_API_TOKEN || ""

    const response = await fetch(`https://fastrpc.mev-commit.xyz/status/${hash}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { success: false, error: errorText || `API returned status ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ success: true, hash, data })
  } catch (error) {
    const errorMessage = "Fast RPC not properly configured"
    console.error("Error querying transaction status:", errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
