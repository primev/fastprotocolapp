import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTokenPrice } from "@/lib/analytics-server"
import { parseSearchParams } from "@/lib/api/parse"
import { tokenSymbolSchema } from "@/lib/api/schemas"

const querySchema = z.object({ symbol: tokenSymbolSchema })

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const { symbol } = parsed

  try {
    const price = await getTokenPrice(symbol)
    if (price === null) {
      return NextResponse.json({ error: `Failed to fetch ${symbol} price` }, { status: 500 })
    }
    // Symbol is already upper-cased by tokenSymbolSchema.transform — no need to re-upper here.
    return NextResponse.json({ success: true, symbol, price })
  } catch (error) {
    console.error("Error fetching token price:", error)
    return NextResponse.json({ error: "Failed to fetch token price" }, { status: 500 })
  }
}
