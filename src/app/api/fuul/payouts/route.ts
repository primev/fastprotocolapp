import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/env/server"
import { parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"
import { fuulPayoutsTotalsSchema } from "@/lib/api/upstream"

const FUUL_TOTALS_URL = "https://api.fuul.xyz/api/v1/payouts/totals"

const querySchema = z.object({ address: walletAddressSchema })

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const address = parsed.address // walletAddressSchema lower-cases this

  try {
    const fuulApiKey = env.FUUL_API_KEY
    if (!fuulApiKey) {
      console.error("FUUL_API_KEY not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Fuul stores/keys addresses in lowercase (their leaderboard endpoint
    // returns lowercase wallets). A checksummed mixed-case lookup against
    // /payouts/totals/{address} 404s even when the wallet has credits, so
    // the schema's lower-case transform is load-bearing — not cosmetic.
    const url = `${FUUL_TOTALS_URL}/${encodeURIComponent(address)}`

    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", Authorization: `Bearer ${fuulApiKey}` },
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
      const rawData = await response.json()

      // Fuul has returned points under several keys over time (`total_points`,
      // `total_payouts`, `total`, `points`). The schema below coerces each
      // candidate into a number and leaves the rest optional; the fallback
      // chain below then picks the first that's defined, keeping legacy
      // field renames from silently zero-ing the UI.
      const parsed = fuulPayoutsTotalsSchema.safeParse(
        typeof rawData === "number" ? { total_points: rawData } : rawData
      )
      if (!parsed.success) {
        console.error("Fuul payouts shape drift:", parsed.error.issues)
        return NextResponse.json(
          { error: "Unexpected response shape from Fuul API" },
          { status: 502 }
        )
      }

      const data = parsed.data
      const totalPoints = data.total_points ?? data.total_payouts ?? data.total ?? data.points ?? 0

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
