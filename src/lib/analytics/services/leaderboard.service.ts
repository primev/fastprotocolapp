"use server"

import { getAnalyticsClient } from "../client"
import type { QueryOptions } from "../client"
import {
  buildTierHavingClause,
  buildCombinedHavingClause,
  type PaginationMeta,
} from "./leaderboard-filters"

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

// ─── Paginated queries with tier filtering ───────────────────────────────────

const VOL_EXPR = "SUM(COALESCE(swap_vol_usd, 0))"
const TABLE = "mevcommit_57173.processed_l1_txns_v2"

export interface PaginatedResult<T> {
  entries: T[]
  pagination: PaginationMeta
}

/**
 * Volume leaders with server-side tier filtering and pagination.
 * Supports sort by: volume, avg_size, largest
 */
export async function getVolumeLeadersPaginated(params: {
  sort: string
  tier: string
  page: number
  limit: number
}): Promise<PaginatedResult<LeaderboardRow | LargestSwapRow>> {
  const { sort, tier, page, limit } = params
  const offset = (page - 1) * limit
  const having = buildTierHavingClause(tier, VOL_EXPR)

  if (sort === "largest") {
    const countSql = `
      SELECT COUNT(*) FROM (
        SELECT lower(from_address) AS wallet
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        ${having || "HAVING MAX(COALESCE(swap_vol_usd, 0)) > 0"}
        ${having ? `AND MAX(COALESCE(swap_vol_usd, 0)) > 0` : ""}
      ) t
    `
    const dataSql = `
      SELECT
        lower(from_address) AS wallet,
        MAX(COALESCE(swap_vol_usd, 0)) AS largest_swap_usd,
        MAX(COALESCE(swap_vol_eth, 0)) AS largest_swap_eth,
        COUNT(*) AS swap_count,
        SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
        SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
      FROM ${TABLE}
      WHERE is_swap = TRUE
      GROUP BY lower(from_address)
      ${having ? having + " AND MAX(COALESCE(swap_vol_usd, 0)) > 0" : "HAVING MAX(COALESCE(swap_vol_usd, 0)) > 0"}
      ORDER BY largest_swap_usd DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const [countRows, dataRows] = await Promise.all([
      client.executeRaw(countSql),
      client.executeRaw(dataSql),
    ])
    const total = Number(countRows[0]?.[0]) || 0
    return {
      entries: dataRows as LargestSwapRow[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  // volume or avg_size — both use same base query, different ORDER BY
  const orderBy =
    sort === "avg_size"
      ? "SUM(COALESCE(swap_vol_usd, 0)) / NULLIF(COUNT(*), 0) DESC"
      : "total_swap_vol_usd DESC"

  const baseHaving = having
    ? having + " AND SUM(COALESCE(swap_vol_eth, 0)) > 0"
    : "HAVING SUM(COALESCE(swap_vol_eth, 0)) > 0"

  const countSql = `
    SELECT COUNT(*) FROM (
      SELECT lower(from_address) AS wallet
      FROM ${TABLE}
      WHERE is_swap = TRUE
      GROUP BY lower(from_address)
      ${baseHaving}
    ) t
  `
  const dataSql = `
    WITH all_time AS (
      SELECT
        lower(from_address) AS wallet,
        SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
        SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
        COUNT(*) AS swap_count
      FROM ${TABLE}
      WHERE is_swap = TRUE
      GROUP BY lower(from_address)
      ${baseHaving}
    ),
    current_24h AS (
      SELECT
        lower(from_address) AS wallet,
        SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_24h,
        SUM(COALESCE(swap_vol_usd, 0)) AS swap_vol_usd_24h
      FROM ${TABLE}
      WHERE is_swap = TRUE
        AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
      GROUP BY lower(from_address)
    ),
    previous_24h AS (
      SELECT
        lower(from_address) AS wallet,
        SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_prev_24h
      FROM ${TABLE}
      WHERE is_swap = TRUE
        AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '2' DAY
        AND l1_timestamp < date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
      GROUP BY lower(from_address)
    )
    SELECT
      a.wallet,
      COALESCE(a.total_swap_vol_eth, 0) AS total_swap_vol_eth,
      COALESCE(a.total_swap_vol_usd, 0) AS total_swap_vol_usd,
      COALESCE(a.swap_count, 0) AS swap_count,
      COALESCE(c.swap_vol_eth_24h, 0) AS swap_vol_eth_24h,
      COALESCE(c.swap_vol_usd_24h, 0) AS swap_vol_usd_24h,
      CASE
        WHEN COALESCE(p.swap_vol_eth_prev_24h, 0) > 0
        THEN ((COALESCE(c.swap_vol_eth_24h, 0) - COALESCE(p.swap_vol_eth_prev_24h, 0)) / p.swap_vol_eth_prev_24h * 100)
        WHEN COALESCE(c.swap_vol_eth_24h, 0) > 0 AND COALESCE(p.swap_vol_eth_prev_24h, 0) = 0
        THEN 100
        ELSE 0
      END AS change_24h_pct
    FROM all_time a
    LEFT JOIN current_24h c ON a.wallet = c.wallet
    LEFT JOIN previous_24h p ON a.wallet = p.wallet
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `
  const [countRows, dataRows] = await Promise.all([
    client.executeRaw(countSql),
    client.executeRaw(dataSql),
  ])
  const total = Number(countRows[0]?.[0]) || 0
  return {
    entries: dataRows as LeaderboardRow[],
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

/**
 * Efficiency leaders with server-side tier filtering and pagination.
 * Supports sort by: tx_count, txs_per_day, streak
 */
export async function getEfficiencyLeadersPaginated(params: {
  sort: string
  tier: string
  page: number
  limit: number
}): Promise<PaginatedResult<unknown[]>> {
  const { sort, tier, page, limit } = params
  const offset = (page - 1) * limit
  const tierHaving = buildTierHavingClause(tier, VOL_EXPR)

  if (sort === "txs_per_day") {
    const baseHaving = buildCombinedHavingClause(
      tier,
      "SUM(COALESCE(swap_vol_usd, 0))",
      "COUNT(DISTINCT CAST(l1_timestamp AS DATE)) >= 1"
    )
    const countSql = `
      SELECT COUNT(*) FROM (
        SELECT lower(from_address) AS wallet
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        ${baseHaving}
      ) t
    `
    const dataSql = `
      SELECT
        lower(from_address) AS wallet,
        COUNT(*) AS swap_count,
        COUNT(DISTINCT CAST(l1_timestamp AS DATE)) AS active_days,
        CAST(COUNT(*) AS DOUBLE) / COUNT(DISTINCT CAST(l1_timestamp AS DATE)) AS txs_per_day,
        SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
        SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
      FROM ${TABLE}
      WHERE is_swap = TRUE
      GROUP BY lower(from_address)
      ${baseHaving}
      ORDER BY txs_per_day DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const [countRows, dataRows] = await Promise.all([
      client.executeRaw(countSql),
      client.executeRaw(dataSql),
    ])
    const total = Number(countRows[0]?.[0]) || 0
    return {
      entries: dataRows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  if (sort === "streak") {
    // The streak query is complex — use the same CTE but add tier filtering via a join
    const tierJoin =
      tier !== "all"
        ? `JOIN (
          SELECT lower(from_address) AS wallet
          FROM ${TABLE}
          WHERE is_swap = TRUE
          GROUP BY lower(from_address)
          ${tierHaving}
        ) tier_filter ON ws.wallet = tier_filter.wallet`
        : ""

    const countSql = `
      WITH wallet_days AS (
        SELECT lower(from_address) AS wallet, CAST(l1_timestamp AS DATE) AS active_day
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address), CAST(l1_timestamp AS DATE)
      ),
      ranked AS (
        SELECT wallet, active_day,
          ROW_NUMBER() OVER (PARTITION BY wallet ORDER BY active_day) AS rn
        FROM wallet_days
      ),
      streaks AS (
        SELECT wallet,
          CAST(active_day AS TIMESTAMP) - rn * INTERVAL '1' DAY AS grp,
          COUNT(*) AS streak_len
        FROM ranked
        GROUP BY wallet, CAST(active_day AS TIMESTAMP) - rn * INTERVAL '1' DAY
      ),
      ws AS (
        SELECT wallet, MAX(streak_len) AS longest_streak
        FROM streaks
        GROUP BY wallet
        HAVING MAX(streak_len) > 0
      )
      SELECT COUNT(*) FROM ws
      ${tierJoin}
    `
    const dataSql = `
      WITH wallet_days AS (
        SELECT lower(from_address) AS wallet, CAST(l1_timestamp AS DATE) AS active_day
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address), CAST(l1_timestamp AS DATE)
      ),
      ranked AS (
        SELECT wallet, active_day,
          ROW_NUMBER() OVER (PARTITION BY wallet ORDER BY active_day) AS rn
        FROM wallet_days
      ),
      streaks AS (
        SELECT wallet,
          CAST(active_day AS TIMESTAMP) - rn * INTERVAL '1' DAY AS grp,
          COUNT(*) AS streak_len
        FROM ranked
        GROUP BY wallet, CAST(active_day AS TIMESTAMP) - rn * INTERVAL '1' DAY
      ),
      wallet_streaks AS (
        SELECT wallet, MAX(streak_len) AS longest_streak
        FROM streaks
        GROUP BY wallet
        HAVING MAX(streak_len) > 0
      ),
      wallet_stats AS (
        SELECT
          lower(from_address) AS wallet,
          COUNT(*) AS swap_count,
          SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
          SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
      )
      SELECT
        ws.wallet,
        ws.longest_streak,
        wst.swap_count,
        wst.total_swap_vol_usd,
        wst.total_swap_vol_eth
      FROM wallet_streaks ws
      JOIN wallet_stats wst ON ws.wallet = wst.wallet
      ${tier !== "all" ? `WHERE wst.total_swap_vol_usd >= ${tier === "gold" ? 1000000 : tier === "silver" ? 100000 : 10000} ${tier !== "gold" ? `AND wst.total_swap_vol_usd < ${tier === "silver" ? 1000000 : 100000}` : ""}` : ""}
      ORDER BY ws.longest_streak DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const [countRows, dataRows] = await Promise.all([
      client.executeRaw(countSql),
      client.executeRaw(dataSql),
    ])
    const total = Number(countRows[0]?.[0]) || 0
    return {
      entries: dataRows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  // tx_count — main leaderboard sorted by swap count
  const baseHaving = tierHaving
    ? tierHaving + " AND SUM(COALESCE(swap_vol_eth, 0)) > 0"
    : "HAVING SUM(COALESCE(swap_vol_eth, 0)) > 0"

  const countSql = `
    SELECT COUNT(*) FROM (
      SELECT lower(from_address) AS wallet
      FROM ${TABLE}
      WHERE is_swap = TRUE
      GROUP BY lower(from_address)
      ${baseHaving}
    ) t
  `
  const dataSql = `
    SELECT
      lower(from_address) AS wallet,
      SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
      SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
      COUNT(*) AS swap_count,
      0 AS swap_vol_eth_24h,
      0 AS swap_vol_usd_24h,
      0 AS change_24h_pct
    FROM ${TABLE}
    WHERE is_swap = TRUE
    GROUP BY lower(from_address)
    ${baseHaving}
    ORDER BY swap_count DESC
    LIMIT ${limit} OFFSET ${offset}
  `
  const [countRows, dataRows] = await Promise.all([
    client.executeRaw(countSql),
    client.executeRaw(dataSql),
  ])
  const total = Number(countRows[0]?.[0]) || 0
  return {
    entries: dataRows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

/**
 * Rising stars with pagination (no tier filter — already filtered to standard tier).
 */
export async function getRisingStarsPaginated(params: {
  sort: string
  page: number
  limit: number
}): Promise<PaginatedResult<unknown[]>> {
  const { sort, page, limit } = params
  const offset = (page - 1) * limit
  const standardMax = 10000

  if (sort === "new_users") {
    const countSql = `
      WITH first_swap AS (
        SELECT lower(from_address) AS wallet, MIN(l1_timestamp) AS first_swap_time
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        HAVING MIN(l1_timestamp) >= CURRENT_TIMESTAMP - INTERVAL '30' DAY
      ),
      wallet_stats AS (
        SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        HAVING SUM(COALESCE(swap_vol_usd, 0)) < ${standardMax}
      )
      SELECT COUNT(*) FROM first_swap f JOIN wallet_stats w ON f.wallet = w.wallet
    `
    const dataSql = `
      WITH first_swap AS (
        SELECT lower(from_address) AS wallet, MIN(l1_timestamp) AS first_swap_time
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        HAVING MIN(l1_timestamp) >= CURRENT_TIMESTAMP - INTERVAL '30' DAY
      ),
      wallet_stats AS (
        SELECT lower(from_address) AS wallet, COUNT(*) AS swap_count,
          SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
          SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        HAVING SUM(COALESCE(swap_vol_usd, 0)) < ${standardMax}
      )
      SELECT f.wallet, w.total_swap_vol_usd, w.total_swap_vol_eth, w.swap_count, f.first_swap_time
      FROM first_swap f JOIN wallet_stats w ON f.wallet = w.wallet
      ORDER BY w.total_swap_vol_usd DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const [countRows, dataRows] = await Promise.all([
      client.executeRaw(countSql),
      client.executeRaw(dataSql),
    ])
    const total = Number(countRows[0]?.[0]) || 0
    return {
      entries: dataRows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  if (sort === "wow_growth") {
    const countSql = `
      WITH total_volume AS (
        SELECT lower(from_address) AS wallet
        FROM ${TABLE} WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        HAVING SUM(COALESCE(swap_vol_usd, 0)) < ${standardMax}
      ),
      this_week AS (
        SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS vol_this_week
        FROM ${TABLE} WHERE is_swap = TRUE AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
        GROUP BY lower(from_address)
      )
      SELECT COUNT(*) FROM this_week t JOIN total_volume tv ON t.wallet = tv.wallet WHERE t.vol_this_week > 0
    `
    const dataSql = `
      WITH total_volume AS (
        SELECT lower(from_address) AS wallet
        FROM ${TABLE} WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        HAVING SUM(COALESCE(swap_vol_usd, 0)) < ${standardMax}
      ),
      this_week AS (
        SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS vol_this_week
        FROM ${TABLE} WHERE is_swap = TRUE AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
        GROUP BY lower(from_address)
      ),
      last_week AS (
        SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS vol_last_week
        FROM ${TABLE} WHERE is_swap = TRUE
          AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '14' DAY
          AND l1_timestamp < CURRENT_TIMESTAMP - INTERVAL '7' DAY
        GROUP BY lower(from_address)
      )
      SELECT t.wallet, t.vol_this_week, COALESCE(l.vol_last_week, 0) AS vol_last_week,
        CASE WHEN COALESCE(l.vol_last_week, 0) > 0
          THEN ((t.vol_this_week - l.vol_last_week) / l.vol_last_week * 100)
          ELSE 100 END AS wow_growth_pct
      FROM this_week t
      JOIN total_volume tv ON t.wallet = tv.wallet
      LEFT JOIN last_week l ON t.wallet = l.wallet
      WHERE t.vol_this_week > 0
      ORDER BY wow_growth_pct DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const [countRows, dataRows] = await Promise.all([
      client.executeRaw(countSql),
      client.executeRaw(dataSql),
    ])
    const total = Number(countRows[0]?.[0]) || 0
    return {
      entries: dataRows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  // climbers
  const countSql = `
    WITH total_volume AS (
      SELECT lower(from_address) AS wallet
      FROM ${TABLE} WHERE is_swap = TRUE
      GROUP BY lower(from_address)
      HAVING SUM(COALESCE(swap_vol_usd, 0)) < ${standardMax}
    ),
    this_week AS (
      SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS vol_this_week
      FROM ${TABLE} WHERE is_swap = TRUE AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
      GROUP BY lower(from_address)
    )
    SELECT COUNT(*) FROM this_week t JOIN total_volume tv ON t.wallet = tv.wallet WHERE t.vol_this_week > 0
  `
  const dataSql = `
    WITH total_volume AS (
      SELECT lower(from_address) AS wallet
      FROM ${TABLE} WHERE is_swap = TRUE
      GROUP BY lower(from_address)
      HAVING SUM(COALESCE(swap_vol_usd, 0)) < ${standardMax}
    ),
    this_week AS (
      SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS vol_this_week
      FROM ${TABLE} WHERE is_swap = TRUE AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
      GROUP BY lower(from_address)
    ),
    last_week AS (
      SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS vol_last_week
      FROM ${TABLE} WHERE is_swap = TRUE
        AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '14' DAY
        AND l1_timestamp < CURRENT_TIMESTAMP - INTERVAL '7' DAY
      GROUP BY lower(from_address)
    )
    SELECT t.wallet, t.vol_this_week, COALESCE(l.vol_last_week, 0) AS vol_last_week,
      t.vol_this_week - COALESCE(l.vol_last_week, 0) AS vol_increase
    FROM this_week t
    JOIN total_volume tv ON t.wallet = tv.wallet
    LEFT JOIN last_week l ON t.wallet = l.wallet
    WHERE t.vol_this_week > 0
    ORDER BY vol_increase DESC
    LIMIT ${limit} OFFSET ${offset}
  `
  const [countRows, dataRows] = await Promise.all([
    client.executeRaw(countSql),
    client.executeRaw(dataSql),
  ])
  const total = Number(countRows[0]?.[0]) || 0
  return {
    entries: dataRows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

/**
 * Find a user's rank and page number within a leaderboard.
 * Returns null if the user is not found in the filtered results.
 */
export async function findUserInLeaderboard(params: {
  wallet: string
  category: string
  sort: string
  tier: string
  pageSize: number
}): Promise<{ rank: number; page: number } | null> {
  const { wallet, category, sort, tier, pageSize } = params
  const addr = sanitizeAddress(wallet)
  const tierHaving = buildTierHavingClause(tier, VOL_EXPR)

  let rankSql: string

  if (category === "volume") {
    const baseHaving = tierHaving
      ? tierHaving + " AND SUM(COALESCE(swap_vol_eth, 0)) > 0"
      : "HAVING SUM(COALESCE(swap_vol_eth, 0)) > 0"

    const orderBy =
      sort === "avg_size"
        ? "SUM(COALESCE(swap_vol_usd, 0)) / NULLIF(COUNT(*), 0) DESC"
        : sort === "largest"
          ? "MAX(COALESCE(swap_vol_usd, 0)) DESC"
          : "SUM(COALESCE(swap_vol_usd, 0)) DESC"

    rankSql = `
      WITH ranked AS (
        SELECT lower(from_address) AS wallet,
          ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rn
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        ${baseHaving}
      )
      SELECT rn FROM ranked WHERE wallet = '${addr}'
    `
  } else if (category === "efficiency") {
    const baseHaving = tierHaving
      ? tierHaving + " AND SUM(COALESCE(swap_vol_eth, 0)) > 0"
      : "HAVING SUM(COALESCE(swap_vol_eth, 0)) > 0"

    const orderBy =
      sort === "txs_per_day"
        ? "CAST(COUNT(*) AS DOUBLE) / COUNT(DISTINCT CAST(l1_timestamp AS DATE)) DESC"
        : sort === "streak"
          ? "COUNT(*) DESC" // Simplified — streak rank is complex, use tx_count as fallback
          : "COUNT(*) DESC"

    rankSql = `
      WITH ranked AS (
        SELECT lower(from_address) AS wallet,
          ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rn
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        ${baseHaving}
      )
      SELECT rn FROM ranked WHERE wallet = '${addr}'
    `
  } else {
    // rising stars — no tier filter, standard tier only
    rankSql = `
      WITH total_volume AS (
        SELECT lower(from_address) AS wallet,
          SUM(COALESCE(swap_vol_usd, 0)) AS total_vol
        FROM ${TABLE}
        WHERE is_swap = TRUE
        GROUP BY lower(from_address)
        HAVING SUM(COALESCE(swap_vol_usd, 0)) < 10000
      ),
      ranked AS (
        SELECT tv.wallet,
          ROW_NUMBER() OVER (ORDER BY tv.total_vol DESC) AS rn
        FROM total_volume tv
      )
      SELECT rn FROM ranked WHERE wallet = '${addr}'
    `
  }

  const rows = await client.executeRaw(rankSql)
  if (!rows.length) return null

  const rank = Number(rows[0][0])
  if (!Number.isFinite(rank)) return null

  return { rank, page: Math.ceil(rank / pageSize) }
}
