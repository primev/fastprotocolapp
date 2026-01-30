import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env/server"
import { isAddress } from "viem"

const FUUL_TOTALS_URL = "https://api.fuul.xyz/api/v1/payouts/totals"

export async function GET(request: NextRequest) {
  try {
    const fuulApiKey = env.FUUL_API_KEY
    if (!fuulApiKey) {
      console.error("FUUL_API_KEY not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: "Valid address query parameter is required" },
        { status: 400 }
      )
    }

    const url = `${FUUL_TOTALS_URL}/${encodeURIComponent(address)}`

    const response = await fetch(url, {
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
        { error: "Failed to fetch total user points from Fuul", details: errorText },
        { status: response.status }
      )
    }

    try {
      const data = await response.json()

      // Fuul returns { "total_points": "0" } (string); coerce to number
      let totalPoints = 0
      if (data?.total_points != null) {
        totalPoints = Number(data.total_points)
      } else if (typeof data === "number") {
        totalPoints = data
      } else if (data?.total_payouts != null) {
        totalPoints = Number(data.total_payouts)
      } else if (data?.total != null) {
        totalPoints = Number(data.total)
      } else if (data?.points != null) {
        totalPoints = Number(data.points)
      }

      return NextResponse.json({ success: true, data, totalPoints }, { status: 200 })
    } catch (parseError) {
      console.error("Failed to parse Fuul API response:", parseError)
      return NextResponse.json({ error: "Failed to parse response from Fuul API" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error fetching total user points from Fuul:", error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Failed to fetch total user points", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "Failed to fetch total user points" }, { status: 500 })
  }
}
