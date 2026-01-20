import { NextRequest, NextResponse } from "next/server"
import { getTokenPrice } from "@/lib/analytics-server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const symbol = searchParams.get("symbol")

    if (!symbol) {
      return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 })
    }

    const price = await getTokenPrice(symbol)

    if (price === null) {
      return NextResponse.json({ error: `Failed to fetch ${symbol} price` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      symbol: symbol.toUpperCase(),
      price: price,
    })
  } catch (error) {
    console.error("Error fetching token price:", error)
    return NextResponse.json({ error: "Failed to fetch token price" }, { status: 500 })
  }
}
