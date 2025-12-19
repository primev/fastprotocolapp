import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"
import { isAddress } from "viem"

interface IdentifyUserPayload {
  identifier: string
  identifierType: "evm_address" | "solana_address" | "xrpl_address"
  trackingId: string
  accountChainId?: number
}

const FUUL_API_URL = "https://api.fuul.xyz/api/v1/events"

export async function POST(request: NextRequest) {
  try {
    const body: IdentifyUserPayload = await request.json()

    // Validate required fields
    if (!body.identifier || !body.trackingId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get Fuul API key from environment
    const fuulApiKey = process.env.FUUL_API_KEY
    if (!fuulApiKey) {
      console.error("FUUL_API_KEY not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Prepare payload for Fuul API (no signature fields needed for backend authentication)
    const fuulPayload: any = {
      metadata: {
        tracking_id: body.trackingId,
      },
      name: "connect_wallet",
      user: {
        identifier: body.identifier,
        identifier_type: "evm_address",
      },
    }

    // Add account_chain_id only if provided (for smart contract wallets)
    if (body.accountChainId !== undefined) {
      fuulPayload.account_chain_id = body.accountChainId
    }

    // Make request to Fuul API
    const response = await fetch(FUUL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fuulApiKey}`,
      },
      body: JSON.stringify(fuulPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fuul API error:", response.status, errorText)
      return NextResponse.json(
        { error: "Failed to identify user with Fuul", details: errorText },
        { status: response.status }
      )
    }

    // Handle empty responses (204 No Content or empty body)
    if (response.status === 204 || !response.body) {
      return NextResponse.json({ success: true })
    }

    // Only parse JSON if response has content
    try {
      const data = await response.json()
      return NextResponse.json({ success: true, data }, { status: 200 })
    } catch (parseError) {
      // If JSON parsing fails but response was OK, still return success
      console.warn("Fuul API returned non-JSON response, but status was OK")
      return NextResponse.json({ success: true }, { status: 200 })
    }
  } catch (error) {
    console.error("Error identifying user with Fuul:", error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Failed to identify user", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "Failed to identify user" }, { status: 500 })
  }
}
