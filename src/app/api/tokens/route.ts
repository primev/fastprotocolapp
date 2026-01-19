import { getUniswapTokenList } from "@/lib/swap-server"
import { NextResponse } from "next/server"

/**
 * API route to fetch Uniswap token list
 * Used by client-side hooks for token list fetching
 */
export async function GET() {
  try {
    const tokens = await getUniswapTokenList()
    return NextResponse.json(tokens)
  } catch (error) {
    console.error("Error fetching token list:", error)
    return NextResponse.json([], { status: 500 })
  }
}
