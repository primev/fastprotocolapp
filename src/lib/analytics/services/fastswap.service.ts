"use server"

import { getAnalyticsClient } from "../client"
import type { QueryOptions } from "../client"

/**
 * Row shape returned by `fastswap/get-user-recent-swaps`.
 * Column order must match the SELECT clause in queries.ts.
 */
export type UserRecentSwapRow = {
  txHash: string
  blockTimestamp: string | null
  swapType: string | null
  inputToken: string | null
  outputToken: string | null
  inputAmount: string | null
  userAmtOut: string | null
  surplusEth: number | null
  miles: number | null
  processed: boolean
}

const client = getAnalyticsClient()

/**
 * Validates and normalizes an Ethereum address to lowercase.
 * Throws on malformed input so SQL injection via the address param is impossible.
 */
function sanitizeAddress(address: string): string {
  const trimmed = address.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error("Invalid Ethereum address")
  }
  return trimmed.toLowerCase()
}

/**
 * Paginated result returned by `getUserRecentSwaps`. `total` is the total
 * number of rows in the DB for the address (not just the current page), so
 * the UI can compute `totalPages` without extra round-trips. `totalMiles`
 * is the sum of miles across all of the user's finalized swaps, used for
 * the table's header chip.
 */
export type UserRecentSwapsPage = {
  rows: UserRecentSwapRow[]
  total: number
  totalMiles: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Maps a single raw StarRocks row (in SELECT order) to a typed
 * UserRecentSwapRow. Kept as a helper so the paginated and count paths
 * don't duplicate column-index knowledge.
 */
function mapRow(row: unknown[]): UserRecentSwapRow {
  return {
    txHash: String(row[0] ?? ""),
    blockTimestamp: row[1] != null ? String(row[1]) : null,
    swapType: row[2] != null ? String(row[2]) : null,
    inputToken: row[3] != null ? String(row[3]) : null,
    outputToken: row[4] != null ? String(row[4]) : null,
    inputAmount: row[5] != null ? String(row[5]) : null,
    userAmtOut: row[6] != null ? String(row[6]) : null,
    surplusEth: row[7] != null && Number.isFinite(Number(row[7])) ? Number(row[7]) : null,
    miles: row[8] != null && Number.isFinite(Number(row[8])) ? Number(row[8]) : null,
    // StarRocks returns booleans as 0/1 — coerce both to JS boolean.
    processed: row[9] === true || row[9] === 1 || row[9] === "1",
  }
}

/**
 * Fetches a paginated slice of FastSwap miles rows for a given user address,
 * along with the total row count for the address so the caller can render
 * page-number UI.
 *
 * Both finalized (`processed=true`) and still-calculating (`processed=false`)
 * rows are included so the UI can surface pending state without forcing a
 * page refresh.
 *
 * @param address  0x-prefixed Ethereum address
 * @param page     1-indexed page number (default 1)
 * @param pageSize rows per page (default 25, hard-capped at 100)
 */
export async function getUserRecentSwaps(
  address: string,
  page = 1,
  pageSize = 25,
  options?: QueryOptions
): Promise<UserRecentSwapsPage> {
  const addr = sanitizeAddress(address)
  const safePageSize = Math.min(Math.max(Math.floor(pageSize), 1), 100)
  const safePage = Math.max(Math.floor(page), 1)
  const offset = (safePage - 1) * safePageSize

  // Fire the page query and the aggregate query in parallel — they hit the
  // same table with the same predicate, so round-trip cost dominates.
  const [rows, aggRows] = await Promise.all([
    client.execute(
      "fastswap/get-user-recent-swaps",
      { address: addr, limit: safePageSize, offset },
      options
    ),
    client.execute("fastswap/get-user-recent-swaps-count", { address: addr }, options),
  ])

  const aggRow = aggRows[0] ?? []
  const total = aggRow[0] != null && Number.isFinite(Number(aggRow[0])) ? Number(aggRow[0]) : 0
  const totalMiles = aggRow[1] != null && Number.isFinite(Number(aggRow[1])) ? Number(aggRow[1]) : 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize)

  return {
    rows: rows.map(mapRow),
    total,
    totalMiles,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  }
}
