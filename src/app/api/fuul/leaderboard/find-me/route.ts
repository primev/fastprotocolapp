import { NextRequest, NextResponse } from "next/server"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"

/**
 * GET /api/fuul/leaderboard/find-me?wallet=0x...&sort=miles&pageSize=25
 *
 * Finds a wallet in the fuul leaderboard and returns which page they appear on.
 * Fetches all pages from the main endpoint to search the complete dataset.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get("wallet")
    const sort = searchParams.get("sort") || "miles"
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "25", 10), 1), 100)

    if (!wallet) {
      return NextResponse.json({ error: "wallet parameter is required" }, { status: 400 })
    }

    const trimmedWallet = trimWalletAddress(wallet.toLowerCase())
    const origin = request.nextUrl.origin

    // Paginate through the internal endpoint to find the wallet
    let currentPage = 1
    let globalIdx = 0

    while (true) {
      const res = await fetch(
        `${origin}/api/fuul/leaderboard?limit=100&page=${currentPage}&sort=${sort}`
      )
      if (!res.ok) break

      const data = await res.json()
      const entries: { wallet: string; rank: number }[] = data.entries || []
      if (entries.length === 0) break

      const idx = entries.findIndex((e) => e.wallet === trimmedWallet)
      if (idx !== -1) {
        const absoluteIdx = globalIdx + idx
        return NextResponse.json({
          success: true,
          found: true,
          rank: entries[idx].rank,
          page: Math.floor(absoluteIdx / pageSize) + 1,
        })
      }

      globalIdx += entries.length
      const totalPages = data.pagination?.totalPages || 0
      if (currentPage >= totalPages) break
      currentPage++
    }

    return NextResponse.json({ success: true, found: false })
  } catch (error) {
    console.error("Error in fuul find-me:", error)
    return NextResponse.json({ error: "Failed to find user" }, { status: 500 })
  }
}
