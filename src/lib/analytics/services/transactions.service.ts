"use server"

import { getAnalyticsClient } from "../client"
import type { QueryOptions } from "../client"

/**
 * Transaction analytics result row
 */
export type TransactionsAnalyticsRow = [
  day_utc: string,
  successful_txs: number,
  unique_senders: number,
  cumulative_successful_txs: number,
  cumulative_unique_senders: number,
  cumulative_successful_txs_chart: number | null,
  cumulative_unique_senders_chart: number | null,
]

/**
 * Swap count result row
 */
export type SwapCountRow = [swap_tx_count: number, total_swap_vol_eth: number]

/**
 * Swap volume result row
 */
export type SwapVolumeRow = [
  day: string,
  cumulative_total_tx_vol_eth: number,
  cumulative_total_swap_vol_eth: number,
]

const client = getAnalyticsClient()

/**
 * Get transaction analytics data (successful transactions, unique senders, etc.)
 * Used by both transactions and active-traders endpoints
 */
export async function getTransactionsAnalytics(
  options?: QueryOptions
): Promise<TransactionsAnalyticsRow[]> {
  const rows = await client.execute("transactions/get-transactions-analytics", undefined, {
    ...options,
    catalog: options?.catalog || "fastrpc",
  })

  return rows as TransactionsAnalyticsRow[]
}

/**
 * Get active traders count from transaction analytics
 * Reuses the same query but extracts the cumulative_unique_senders value
 */
export async function getActiveTraders(options?: QueryOptions): Promise<number | null> {
  const rows = await getTransactionsAnalytics(options)

  if (rows.length === 0) {
    return null
  }

  // Get the first row (most recent day)
  // Index 4 is cumulative_unique_senders (always has a value)
  // Index 6 is cumulative_unique_senders_chart (only if date >= 2025-11-20)
  const latestRow = rows[0]
  const activeTraders =
    latestRow[4] !== null && latestRow[4] !== undefined
      ? Number(latestRow[4])
      : latestRow[6] !== null && latestRow[6] !== undefined
        ? Number(latestRow[6])
        : null

  return activeTraders !== null && !isNaN(activeTraders) ? activeTraders : null
}

/**
 * Get cumulative successful transactions count from transaction analytics
 */
export async function getCumulativeSuccessfulTransactions(
  options?: QueryOptions
): Promise<number | null> {
  const rows = await getTransactionsAnalytics(options)

  if (rows.length === 0) {
    return null
  }

  // Get the first row (most recent day)
  // Index 3 is cumulative_successful_txs (always has a value)
  // Index 5 is cumulative_successful_txs_chart (only if date >= 2025-11-20)
  const latestRow = rows[0]
  const cumulativeTxs =
    latestRow[3] !== null && latestRow[3] !== undefined
      ? Number(latestRow[3])
      : latestRow[5] !== null && latestRow[5] !== undefined
        ? Number(latestRow[5])
        : null

  return cumulativeTxs !== null && !isNaN(cumulativeTxs) ? cumulativeTxs : null
}

/**
 * Get global swap transaction count
 * Ensures swaps exist in the FastRPC transactions table
 */
export async function getSwapCount(options?: QueryOptions): Promise<number | null> {
  const rows = await client.execute("transactions/get-swap-count", undefined, options)

  if (rows.length === 0) {
    return null
  }

  const row = rows[0] as SwapCountRow
  const swapTxCount = row[0] !== null && row[0] !== undefined ? Number(row[0]) : null

  return swapTxCount !== null && !isNaN(swapTxCount) ? swapTxCount : null
}

/**
 * Get cumulative swap volume over time
 * Returns the most recent day's cumulative swap volume
 */
export async function getSwapVolume(options?: QueryOptions): Promise<number | null> {
  const rows = await client.execute("transactions/get-swap-volume", undefined, options)

  if (rows.length === 0) {
    return null
  }

  // Get the first row (most recent day) - the query already orders by day DESC
  // Format: [day, cumulative_total_tx_vol_eth, cumulative_total_swap_vol_eth]
  const latestRow = rows[0] as SwapVolumeRow

  // Extract cumulative_total_swap_vol_eth from index 2 (swap volume)
  const cumulativeSwapVolume =
    latestRow[2] !== null && latestRow[2] !== undefined ? Number(latestRow[2]) : null

  return cumulativeSwapVolume !== null && !isNaN(cumulativeSwapVolume) ? cumulativeSwapVolume : null
}
