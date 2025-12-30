import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"

const FUUL_API_URL = "https://api.fuul.xyz/api/v1/payouts/summary"

export async function GET(request: NextRequest) {
  try {
    // Get Fuul API key from environment
    const fuulApiKey = env.FUUL_API_KEY
    if (!fuulApiKey) {
      console.error("FUUL_API_KEY not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Get currency query parameter (defaults to 'point' if not provided)
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get("currency") || "point"

    // Build the URL with query parameters
    const url = new URL(FUUL_API_URL)
    url.searchParams.set("currency", currency)

    // Make request to Fuul API
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${fuulApiKey}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fuul API error:", response.status, errorText)
      return NextResponse.json(
        { error: "Failed to fetch payout summary from Fuul", details: errorText },
        { status: response.status }
      )
    }

    // Parse and return the response
    try {
      const data = await response.json()
      return NextResponse.json({ success: true, data }, { status: 200 })
    } catch (parseError) {
      console.error("Failed to parse Fuul API response:", parseError)
      return NextResponse.json({ error: "Failed to parse response from Fuul API" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error fetching payout summary from Fuul:", error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Failed to fetch payout summary", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "Failed to fetch payout summary" }, { status: 500 })
  }
}
