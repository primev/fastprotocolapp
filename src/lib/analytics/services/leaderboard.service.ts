"use server"

import { getAnalyticsClient } from "../client"
import type { QueryOptions } from "../client"

/**
 * Leaderboard entry row from main leaderboard query
 */
export type LeaderboardRow = [
  wallet: string,
  total_swap_vol_eth: number,
  total_swap_vol_usd: number,
  swap_count: number,
  swap_vol_eth_24h: number,
  swap_vol_usd_24h: number,
  change_24h_pct: number,
]

/**
 * User leaderboard data row
 */
export type UserLeaderboardDataRow = [
  total_swap_vol_eth: number,
  total_swap_vol_usd: number,
  swap_count: number,
  swap_vol_eth_24h: number,
  swap_vol_usd_24h: number,
  change_24h_pct: number,
]

/**
 * User rank result
 */
export type UserRankResult = [user_rank: number]

/**
 * Next rank threshold result (eth and usd)
 */
export type NextRankThresholdResult = [
  total_swap_vol_eth: number | null,
  total_swap_vol_usd: number | null,
]

/**
 * Efficiency row: transactions per day
 */
export type TxsPerDayRow = [
  wallet: string,
  swap_count: number,
  active_days: number,
  txs_per_day: number,
  total_swap_vol_usd: number,
  total_swap_vol_eth: number,
]

/**
 * Efficiency row: longest consecutive active streak
 */
export type StreakRow = [
  wallet: string,
  longest_streak: number,
  swap_count: number,
  total_swap_vol_usd: number,
  total_swap_vol_eth: number,
]

/**
 * Rising Stars: new user row
 */
export type NewUserRow = [
  wallet: string,
  total_swap_vol_usd: number,
  total_swap_vol_eth: number,
  swap_count: number,
  first_swap_time: string,
]

/**
 * Rising Stars: week-over-week growth row
 */
export type WoWGrowthRow = [
  wallet: string,
  vol_this_week: number,
  vol_last_week: number,
  wow_growth_pct: number,
]

/**
 * Rising Stars: climber row (absolute volume increase)
 */
export type ClimberRow = [
  wallet: string,
  vol_this_week: number,
  vol_last_week: number,
  vol_increase: number,
]

/**
 * Leaderboard row sorted by largest single swap
 */
export type LargestSwapRow = [
  wallet: string,
  largest_swap_usd: number,
  largest_swap_eth: number,
  swap_count: number,
  total_swap_vol_usd: number,
  total_swap_vol_eth: number,
]

const client = getAnalyticsClient()

/**
 * Validates and sanitizes an Ethereum address
 */
function sanitizeAddress(address: string): string {
  const trimmed = address.trim()
  const isHexAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed)
  if (!isHexAddress) {
    throw new Error("Invalid Ethereum address")
  }
  return trimmed.toLowerCase()
}

/**
 * Get main leaderboard (top N users by swap volume)
 * @param limit Number of top users to return (default: 15, max: 100)
 */
export async function getLeaderboard(
  limit: number = 15,
  options?: QueryOptions
): Promise<LeaderboardRow[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100))

  const rows = await client.execute("leaderboard/main-leaderboard", { limit: safeLimit }, options)

  return rows as LeaderboardRow[]
}

/**
 * Get user-specific leaderboard data (volume, count, 24h change)
 */
export async function getUserLeaderboardData(
  address: string,
  options?: QueryOptions
): Promise<UserLeaderboardDataRow | null> {
  const addr = sanitizeAddress(address)

  const row = await client.executeOne("leaderboard/user-data", { addr }, options)

  if (!row) {
    return null
  }

  return row as UserLeaderboardDataRow
}

/**
 * Get user's rank position in the leaderboard
 * Returns the rank (1-indexed) or null if user has no swap volume
 */
export async function getUserRank(address: string, options?: QueryOptions): Promise<number | null> {
  const addr = sanitizeAddress(address)

  const row = await client.executeOne("leaderboard/user-rank", { addr }, options)

  if (!row) {
    return null
  }

  const rank = Number(row[0])
  return Number.isFinite(rank) ? rank : null
}

/**
 * Get the volume threshold needed to reach the next rank (ETH and USD)
 * Returns the total swap volume of the user just above the current user
 * Returns { eth: null, usd: null } if user is already #1 or has no swap volume
 */
export async function getNextRankThreshold(
  address: string,
  options?: QueryOptions
): Promise<{ eth: number | null; usd: number | null }> {
  const addr = sanitizeAddress(address)

  const row = await client.executeOne("leaderboard/next-rank-threshold", { addr }, options)

  if (!row) {
    return { eth: null, usd: null }
  }

  const eth = row[0] !== null && row[0] !== undefined ? Number(row[0]) : null
  const usd = row[1] !== null && row[1] !== undefined ? Number(row[1]) : null
  return {
    eth: eth !== null && Number.isFinite(eth) ? eth : null,
    usd: usd !== null && Number.isFinite(usd) ? usd : null,
  }
}

/**
 * Get leaderboard sorted by largest single swap
 * @param limit Number of top users to return (default: 15, max: 100)
 */
export async function getLeaderboardByLargestSwap(
  limit: number = 15,
  options?: QueryOptions
): Promise<LargestSwapRow[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const rows = await client.execute("leaderboard/by-largest-swap", { limit: safeLimit }, options)
  return rows as LargestSwapRow[]
}

/**
 * Get efficiency leaderboard by transactions per day
 * @param limit Number of top users to return (default: 15, max: 100)
 */
export async function getEfficiencyByTxsPerDay(
  limit: number = 15,
  options?: QueryOptions
): Promise<TxsPerDayRow[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const rows = await client.execute("leaderboard/by-txs-per-day", { limit: safeLimit }, options)
  return rows as TxsPerDayRow[]
}

/**
 * Get efficiency leaderboard by longest consecutive active streak
 * @param limit Number of top users to return (default: 15, max: 100)
 */
export async function getEfficiencyByStreak(
  limit: number = 15,
  options?: QueryOptions
): Promise<StreakRow[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const rows = await client.execute("leaderboard/by-streak", { limit: safeLimit }, options)
  return rows as StreakRow[]
}

/**
 * Get rising stars: new users (first swap in last 30 days) ranked by volume
 */
export async function getRisingStarsNewUsers(
  limit: number = 15,
  options?: QueryOptions
): Promise<NewUserRow[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const rows = await client.execute("leaderboard/rising-new-users", { limit: safeLimit }, options)
  return rows as NewUserRow[]
}

/**
 * Get rising stars: week-over-week volume growth
 */
export async function getRisingStarsWoWGrowth(
  limit: number = 15,
  options?: QueryOptions
): Promise<WoWGrowthRow[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const rows = await client.execute("leaderboard/rising-wow-growth", { limit: safeLimit }, options)
  return rows as WoWGrowthRow[]
}

/**
 * Get rising stars: climbers (biggest absolute volume increase week over week)
 */
export async function getRisingStarsClimbers(
  limit: number = 15,
  options?: QueryOptions
): Promise<ClimberRow[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const rows = await client.execute("leaderboard/rising-climbers", { limit: safeLimit }, options)
  return rows as ClimberRow[]
}
