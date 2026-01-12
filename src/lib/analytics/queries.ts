/**
 * SQL Queries Registry
 * All SQL queries are stored as template literals for:
 * - Zero bundle risk (always included in Vercel builds)
 * - Type safety with TypeScript
 * - Easy maintenance and version control
 *
 */

// Transactions domain
// SQL syntax highlighting: Install "es6-string-html" VS Code extension and use /* SQL */ before template literals
export const GET_TRANSACTIONS_ANALYTICS = `
WITH base AS (
  SELECT
    sender,
    DATE(FROM_UNIXTIME(1766015999 + (CAST(block_number AS BIGINT) - 24035770) * 12)) AS day_utc
  FROM mctransactions_sr
  WHERE status IN ('confirmed','pre-confirmed')
),
daily AS (
  SELECT
    day_utc,
    COUNT(*) AS successful_txs,
    COUNT(DISTINCT sender) AS unique_senders
  FROM base
  GROUP BY day_utc
),
sender_first AS (
  SELECT sender, MIN(day_utc) AS first_day_utc
  FROM base
  GROUP BY sender
),
new_senders AS (
  SELECT first_day_utc AS day_utc, COUNT(*) AS new_senders
  FROM sender_first
  GROUP BY first_day_utc
),
enriched AS (
  SELECT
    d.day_utc,
    d.successful_txs,
    d.unique_senders,
    SUM(d.successful_txs) OVER (ORDER BY d.day_utc) AS cumulative_successful_txs,
    SUM(COALESCE(n.new_senders, 0)) OVER (ORDER BY d.day_utc) AS cumulative_unique_senders
  FROM daily d
  LEFT JOIN new_senders n
    ON n.day_utc = d.day_utc
)
SELECT
  day_utc,
  successful_txs,
  unique_senders,
  cumulative_successful_txs,
  cumulative_unique_senders,
  CASE WHEN day_utc >= DATE '2025-11-20' THEN cumulative_successful_txs ELSE NULL END AS cumulative_successful_txs_chart,
  CASE WHEN day_utc >= DATE '2025-11-20' THEN cumulative_unique_senders ELSE NULL END AS cumulative_unique_senders_chart
FROM enriched
ORDER BY day_utc DESC
`.trim()

export const GET_SWAP_COUNT = `
SELECT
  COUNT(*) AS swap_tx_count,
  SUM(COALESCE(p.swap_vol_eth, 0)) AS total_swap_vol_eth
FROM mevcommit_57173.processed_l1_txns_v2 p
WHERE p.is_swap = TRUE
  AND EXISTS (
    SELECT 1
    FROM pg_mev_commit_fastrpc.public.mctransactions_sr m
    WHERE lower(m.hash) = concat('0x', lower(p.l1_tx_hash))
  )
`.trim()

export const GET_SWAP_VOLUME = `
WITH daily AS (
  SELECT
    date_trunc('day', l1_timestamp) AS day,
    SUM(COALESCE(total_vol_eth, 0)) AS daily_total_tx_vol_eth,
    SUM(COALESCE(swap_vol_eth, 0))  AS daily_total_swap_vol_eth
  FROM mevcommit_57173.processed_l1_txns_v2
  GROUP BY 1
),
cumulative AS (
  SELECT
    CAST(day AS VARCHAR) AS day,
    SUM(daily_total_tx_vol_eth) OVER (
      ORDER BY day ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_total_tx_vol_eth,
    SUM(daily_total_swap_vol_eth) OVER (
      ORDER BY day ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_total_swap_vol_eth
  FROM daily
)
SELECT
  day,
  cumulative_total_tx_vol_eth,
  cumulative_total_swap_vol_eth
FROM cumulative
WHERE CAST(day AS DATE) >= DATE '2025-11-20'
ORDER BY day DESC
`.trim()

// Leaderboard domain
export const MAIN_LEADERBOARD = `
WITH all_time AS (
  SELECT 
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
    COUNT(*) AS swap_count
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
),
current_24h AS (
  SELECT 
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_24h
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
  GROUP BY lower(from_address)
),
previous_24h AS (
  SELECT 
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_prev_24h
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '2' DAY
    AND l1_timestamp < date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
  GROUP BY lower(from_address)
)
SELECT 
  a.wallet,
  COALESCE(a.total_swap_vol_eth, 0) AS total_swap_vol_eth,
  COALESCE(a.swap_count, 0) AS swap_count,
  COALESCE(c.swap_vol_eth_24h, 0) AS swap_vol_eth_24h,
  CASE 
    WHEN COALESCE(p.swap_vol_eth_prev_24h, 0) > 0 
    THEN ((COALESCE(c.swap_vol_eth_24h, 0) - COALESCE(p.swap_vol_eth_prev_24h, 0)) / p.swap_vol_eth_prev_24h * 100)
    WHEN COALESCE(c.swap_vol_eth_24h, 0) > 0 AND COALESCE(p.swap_vol_eth_prev_24h, 0) = 0
    THEN 100  -- New activity
    ELSE 0
  END AS change_24h_pct
FROM all_time a
LEFT JOIN current_24h c ON a.wallet = c.wallet
LEFT JOIN previous_24h p ON a.wallet = p.wallet
WHERE COALESCE(a.total_swap_vol_eth, 0) > 0
ORDER BY a.total_swap_vol_eth DESC
LIMIT :limit
`.trim()

export const LEADERBOARD_USER_DATA = `
WITH all_time_user AS (
  SELECT 
    SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
    COUNT(*) AS swap_count
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND lower(from_address) = lower(:addr)
),
current_24h_user AS (
  SELECT 
    SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_24h
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND lower(from_address) = lower(:addr)
    AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
),
previous_24h_user AS (
  SELECT 
    SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_prev_24h
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND lower(from_address) = lower(:addr)
    AND l1_timestamp >= date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '2' DAY
    AND l1_timestamp < date_trunc('day', CURRENT_TIMESTAMP) - INTERVAL '1' DAY
)
SELECT 
  COALESCE(a.total_swap_vol_eth, 0) AS total_swap_vol_eth,
  COALESCE(a.swap_count, 0) AS swap_count,
  COALESCE(c.swap_vol_eth_24h, 0) AS swap_vol_eth_24h,
  CASE 
    WHEN COALESCE(p.swap_vol_eth_prev_24h, 0) > 0 
    THEN ((COALESCE(c.swap_vol_eth_24h, 0) - COALESCE(p.swap_vol_eth_prev_24h, 0)) / p.swap_vol_eth_prev_24h * 100)
    WHEN COALESCE(c.swap_vol_eth_24h, 0) > 0 AND COALESCE(p.swap_vol_eth_prev_24h, 0) = 0
    THEN 100
    ELSE 0
  END AS change_24h_pct
FROM all_time_user a
LEFT JOIN current_24h_user c ON 1=1
LEFT JOIN previous_24h_user p ON 1=1
`.trim()

export const LEADERBOARD_USER_RANK = `
SELECT COUNT(*) + 1 AS user_rank
FROM (
  SELECT 
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING SUM(COALESCE(swap_vol_eth, 0)) > (
    SELECT SUM(COALESCE(swap_vol_eth, 0))
    FROM mevcommit_57173.processed_l1_txns_v2
    WHERE is_swap = TRUE
      AND lower(from_address) = lower(:addr)
  )
) higher_volumes
`.trim()

export const LEADERBOARD_NEXT_RANK_THRESHOLD = `
SELECT 
  MIN(total_swap_vol_eth) AS total_swap_vol_eth
FROM (
  SELECT 
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING SUM(COALESCE(swap_vol_eth, 0)) > (
    SELECT SUM(COALESCE(swap_vol_eth, 0))
    FROM mevcommit_57173.processed_l1_txns_v2
    WHERE is_swap = TRUE
      AND lower(from_address) = lower(:addr)
  )
) higher_volumes
`.trim()

// Users domain
export const GET_USER_SWAP_VOLUME = `
SELECT
  SUM(COALESCE(p.swap_vol_eth, 0)) AS total_swap_vol_eth
FROM mevcommit_57173.processed_l1_txns_v2 p
WHERE lower(p.from_address) = lower(:addr)
  AND p.is_swap = TRUE
`.trim()

/**
 * Centralized queries registry
 * Maps query keys to SQL template literals
 */
export const QUERIES = {
  // Transactions domain
  "transactions/get-transactions-analytics": GET_TRANSACTIONS_ANALYTICS,
  "transactions/get-active-traders": GET_TRANSACTIONS_ANALYTICS, // Reuses same query
  "transactions/get-swap-count": GET_SWAP_COUNT,
  "transactions/get-swap-volume": GET_SWAP_VOLUME,

  // Leaderboard domain
  "leaderboard/main-leaderboard": MAIN_LEADERBOARD,
  "leaderboard/user-data": LEADERBOARD_USER_DATA,
  "leaderboard/user-rank": LEADERBOARD_USER_RANK,
  "leaderboard/next-rank-threshold": LEADERBOARD_NEXT_RANK_THRESHOLD,

  // Users domain
  "users/get-user-swap-volume": GET_USER_SWAP_VOLUME,
} as const
