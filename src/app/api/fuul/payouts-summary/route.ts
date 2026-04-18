import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/env/server"
import { parseSearchParams } from "@/lib/api/parse"

const FUUL_API_URL = "https://api.fuul.xyz/api/v1/payouts/summary"

// `point` is the only currency the miles UI currently cares about, but
// Fuul supports more. Accept any non-empty string so the proxy doesn't
// block future unit additions — Fuul itself will 400 on unknown values.
const querySchema = z.object({
  currency: z.string().min(1).default("point"),
})

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const { currency } = parsed

  try {
    const fuulApiKey = env.FUUL_API_KEY
    if (!fuulApiKey) {
      console.error("FUUL_API_KEY not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const url = new URL(FUUL_API_URL)
    url.searchParams.set("currency", currency)

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json", Authorization: `Bearer ${fuulApiKey}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fuul API error:", response.status, errorText)
      return NextResponse.json(
        { error: "Failed to fetch payout summary from Fuul", details: errorText },
        { status: response.status }
      )
    }

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
