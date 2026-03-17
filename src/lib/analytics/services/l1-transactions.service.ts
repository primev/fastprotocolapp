"use server"

import { getAnalyticsClient } from "../client"
import type { QueryOptions } from "../client"

/**
 * L1 swap tx hash result row
 */
export type L1SwapTxHashRow = [tx_hash: string]

const client = getAnalyticsClient()

/**
 * Get the most recent L1 swap transaction hashes from processed_l1_txns_v2.
 * Returns hashes with 0x prefix, ordered by l1_timestamp DESC.
 */
export async function getRecentL1SwapTxHashes(
  limit: number = 200,
  options?: QueryOptions
): Promise<string[]> {
  const rows = await client.execute("l1/get-recent-swap-tx-hashes", { limit }, options)

  return (rows as L1SwapTxHashRow[])
    .map((row) => row[0])
    .filter((h) => typeof h === "string" && h.startsWith("0x"))
}
