import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getUserRecentSwaps } from "@/lib/analytics/services/fastswap.service"
import tokenList from "@/lib/token-list.json"
import { ZERO_ADDRESS } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"

/**
 * Force per-request execution — users expect near-live data after a swap,
 * and Next.js otherwise tries to cache route handlers when it can infer
 * stable inputs.
 */
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Resolved token metadata returned to the client for rendering.
 * `symbol` falls back to a truncated address when the token is unknown.
 */
type ResolvedToken = {
  address: string
  symbol: string
  logoURI: string | null
  decimals: number
  unknown: boolean
}

/**
 * Swap row shape returned to the client. All token amounts are pre-formatted
 * as decimal strings so the frontend doesn't need to know token decimals.
 */
type ApiSwapRow = {
  txHash: string
  blockTimestamp: string | null
  swapType: string | null
  tokenIn: ResolvedToken
  tokenOut: ResolvedToken
  amountIn: string | null
  amountOut: string | null
  surplusEth: number | null
  miles: number | null
  processed: boolean
}

/**
 * Build an address → Token map once per cold start. The token list is static
 * JSON, so this lookup table is safe to cache at module scope.
 */
const tokensByAddress: Map<string, Token> = (() => {
  const map = new Map<string, Token>()
  for (const t of tokenList as Token[]) {
    map.set(t.address.toLowerCase(), t)
  }
  return map
})()

/**
 * Resolve a token address (as stored in fastswap_miles) to display metadata.
 *
 * - `null` input token means native ETH (the DB stores ETH as NULL).
 * - `0x0000…0000` output token also means native ETH.
 * - Addresses not in the curated token list fall back to a truncated hex label
 *   so unknown tokens still render something sensible instead of a crash.
 */
function resolveToken(rawAddress: string | null): ResolvedToken {
  if (!rawAddress || rawAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    const eth = tokensByAddress.get(ZERO_ADDRESS.toLowerCase())
    return {
      address: ZERO_ADDRESS,
      symbol: eth?.symbol ?? "ETH",
      logoURI: eth?.logoURI ?? null,
      decimals: eth?.decimals ?? 18,
      unknown: false,
    }
  }

  const lower = rawAddress.toLowerCase()
  const token = tokensByAddress.get(lower)
  if (token) {
    return {
      address: token.address,
      symbol: token.symbol,
      logoURI: token.logoURI ?? null,
      decimals: token.decimals,
      unknown: false,
    }
  }

  return {
    address: rawAddress,
    symbol: `${rawAddress.slice(0, 6)}…${rawAddress.slice(-4)}`,
    logoURI: null,
    decimals: 18,
    unknown: true,
  }
}

/**
 * Convert a raw token amount (smallest unit, as a string of digits) into a
 * human-readable decimal string with up to 6 significant fractional digits.
 *
 * Uses BigInt for the integer part to avoid precision loss on large amounts
 * (e.g. USDT 8-decimal balances or 18-decimal ETH values beyond 2^53).
 */
function formatTokenAmount(raw: string | null, decimals: number): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed === "" || !/^-?\d+$/.test(trimmed)) return null

  const negative = trimmed.startsWith("-")
  const digits = negative ? trimmed.slice(1) : trimmed

  const pad = digits.padStart(decimals + 1, "0")
  const intPart = pad.slice(0, pad.length - decimals) || "0"
  const fracPartFull = decimals > 0 ? pad.slice(pad.length - decimals) : ""

  // Trim trailing zeros and cap fractional precision at 6 digits for display.
  const fracTrimmed = fracPartFull.replace(/0+$/, "").slice(0, 6)

  const result = fracTrimmed.length > 0 ? `${intPart}.${fracTrimmed}` : intPart
  return negative ? `-${result}` : result
}

/**
 * GET /api/fastswap-miles/by-address?address=0x…&page=1&pageSize=25
 *
 * Returns a paginated slice of FastSwap rows for the user, with tokens
 * resolved to symbols/logos and amounts pre-formatted as decimal strings.
 *
 * Response shape:
 *   {
 *     success: true,
 *     swaps: ApiSwapRow[],
 *     pagination: { page, pageSize, total, totalPages }
 *   }
 *
 * Status rules for the UI:
 *   - `processed = false` → "Calculating"
 *   - `processed = true`  → show `miles` (may be 0 for unprofitable swaps)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")
    const pageParam = searchParams.get("page")
    const pageSizeParam = searchParams.get("pageSize")

    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: "Valid address query parameter is required" },
        { status: 400 }
      )
    }

    let page = 1
    if (pageParam) {
      const parsed = parseInt(pageParam, 10)
      if (Number.isFinite(parsed) && parsed > 0) page = parsed
    }

    let pageSize = 25
    if (pageSizeParam) {
      const parsed = parseInt(pageSizeParam, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        pageSize = Math.min(parsed, 100)
      }
    }

    const result = await getUserRecentSwaps(address, page, pageSize)

    const swaps: ApiSwapRow[] = result.rows.map((row) => {
      // For eth_weth swaps, the "input" is ETH and input_token is NULL in the
      // DB. For erc20 swaps both sides are populated. resolveToken handles
      // both cases uniformly.
      const tokenIn = resolveToken(row.inputToken)
      const tokenOut = resolveToken(row.outputToken)

      return {
        txHash: row.txHash,
        blockTimestamp: row.blockTimestamp,
        swapType: row.swapType,
        tokenIn,
        tokenOut,
        amountIn: formatTokenAmount(row.inputAmount, tokenIn.decimals),
        amountOut: formatTokenAmount(row.userAmtOut, tokenOut.decimals),
        surplusEth: row.surplusEth,
        miles: row.miles,
        processed: row.processed,
      }
    })

    return NextResponse.json(
      {
        success: true,
        swaps,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
        totalMiles: result.totalMiles,
      },
      {
        status: 200,
        // Near-live data — never cache. Polling on the client is responsible
        // for deciding when to re-fetch; the response itself should always
        // reflect the current DB state.
        headers: { "Cache-Control": "no-store" },
      }
    )
  } catch (error) {
    console.error("[api/fastswap-miles/by-address] Failed:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to fetch swaps", details: message }, { status: 500 })
  }
}
