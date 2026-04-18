import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const querySchema = z.object({
  wallet: walletAddressSchema,
  sort: z.enum(["miles", "payouts"]).default("miles"),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

/**
 * GET /api/fuul/leaderboard/find-me?wallet=0x...&sort=miles&pageSize=25
 *
 * Finds a wallet in the fuul leaderboard and returns which page they appear on.
 * Paginates through the internal endpoint to search the complete dataset.
 */
export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const { wallet, sort, pageSize } = parsed

  try {
    const trimmedWallet = trimWalletAddress(wallet)
    const origin = request.nextUrl.origin

    let currentPage = 1
    let globalIdx = 0

    // Unbounded-looking loop is bounded by the inner break on empty entries
    // and by the `currentPage >= totalPages` check at the tail.
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
