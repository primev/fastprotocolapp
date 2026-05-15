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
  SUM(COALESCE(p.swap_vol_eth, 0)) AS total_swap_vol_eth,
  SUM(COALESCE(p.swap_vol_usd, 0)) AS total_swap_vol_usd
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
    SUM(COALESCE(swap_vol_eth, 0))  AS daily_total_swap_vol_eth,
    SUM(COALESCE(total_vol_usd, 0)) AS daily_total_tx_vol_usd,
    SUM(COALESCE(swap_vol_usd, 0))  AS daily_total_swap_vol_usd
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
    ) AS cumulative_total_swap_vol_eth,
    SUM(daily_total_tx_vol_usd) OVER (
      ORDER BY day ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_total_tx_vol_usd,
    SUM(daily_total_swap_vol_usd) OVER (
      ORDER BY day ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_total_swap_vol_usd
  FROM daily
)
SELECT
  day,
  cumulative_total_tx_vol_eth,
  cumulative_total_swap_vol_eth,
  cumulative_total_tx_vol_usd,
  cumulative_total_swap_vol_usd
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
    SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
    COUNT(*) AS swap_count
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
),
current_24h AS (
  SELECT 
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_24h,
    SUM(COALESCE(swap_vol_usd, 0)) AS swap_vol_usd_24h
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
  COALESCE(a.total_swap_vol_usd, 0) AS total_swap_vol_usd,
  COALESCE(a.swap_count, 0) AS swap_count,
  COALESCE(c.swap_vol_eth_24h, 0) AS swap_vol_eth_24h,
  COALESCE(c.swap_vol_usd_24h, 0) AS swap_vol_usd_24h,
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
    SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
    COUNT(*) AS swap_count
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND lower(from_address) = lower(:addr)
),
current_24h_user AS (
  SELECT 
    SUM(COALESCE(swap_vol_eth, 0)) AS swap_vol_eth_24h,
    SUM(COALESCE(swap_vol_usd, 0)) AS swap_vol_usd_24h
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
  MIN(total_swap_vol_eth) AS total_swap_vol_eth,
  MIN(total_swap_vol_usd) AS total_swap_vol_usd
FROM (
  SELECT 
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
    SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd
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

// All wallets with any swap volume (for testing-whitelist sync)
export const ALL_SWAP_WALLETS = `
SELECT
  lower(from_address) AS wallet,
  SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
  SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
  COUNT(*) AS swap_count
FROM mevcommit_57173.processed_l1_txns_v2
WHERE is_swap = TRUE
GROUP BY lower(from_address)
HAVING SUM(COALESCE(swap_vol_usd, 0)) > 0
ORDER BY total_swap_vol_usd DESC
`.trim()

// Whitelist generation domain
export const WHITELIST_TOP_BY_VOLUME = `
SELECT
  lower(from_address) AS wallet,
  SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
  SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
  COUNT(*) AS swap_count
FROM mevcommit_57173.processed_l1_txns_v2
WHERE is_swap = TRUE
GROUP BY lower(from_address)
HAVING SUM(COALESCE(swap_vol_usd, 0)) > 0
ORDER BY total_swap_vol_usd DESC
LIMIT :limit
`.trim()

export const WHITELIST_TOP_BY_COUNT = `
SELECT
  lower(from_address) AS wallet,
  COUNT(*) AS swap_count,
  SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
  SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
FROM mevcommit_57173.processed_l1_txns_v2
WHERE is_swap = TRUE
GROUP BY lower(from_address)
HAVING COUNT(*) > 0
ORDER BY swap_count DESC
LIMIT :limit
`.trim()

export const WHITELIST_TOP_BY_RECENT_COUNT = `
SELECT
  lower(from_address) AS wallet,
  COUNT(*) AS recent_swap_count,
  SUM(COALESCE(swap_vol_usd, 0)) AS recent_swap_vol_usd,
  SUM(COALESCE(swap_vol_eth, 0)) AS recent_swap_vol_eth
FROM mevcommit_57173.processed_l1_txns_v2
WHERE is_swap = TRUE
  AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '14' DAY
GROUP BY lower(from_address)
HAVING COUNT(*) > 0
ORDER BY recent_swap_count DESC
LIMIT :limit
`.trim()

// Efficiency leaders: by average transactions per day
export const EFFICIENCY_BY_TXS_PER_DAY = `
WITH daily_activity AS (
  SELECT
    lower(from_address) AS wallet,
    CAST(date_trunc('day', l1_timestamp) AS DATE) AS active_day
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address), CAST(date_trunc('day', l1_timestamp) AS DATE)
),
wallet_stats AS (
  SELECT
    lower(from_address) AS wallet,
    COUNT(*) AS swap_count,
    SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
    SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
),
days_active AS (
  SELECT wallet, COUNT(*) AS active_days
  FROM daily_activity
  GROUP BY wallet
)
SELECT
  w.wallet,
  w.swap_count,
  d.active_days,
  CAST(w.swap_count AS DOUBLE) / d.active_days AS txs_per_day,
  w.total_swap_vol_usd,
  w.total_swap_vol_eth
FROM wallet_stats w
JOIN days_active d ON w.wallet = d.wallet
WHERE w.swap_count > 0
ORDER BY txs_per_day DESC
LIMIT :limit
`.trim()

// Efficiency leaders: by longest consecutive active days (streak)
// Uses mctransactions table (fastrpc catalog — pg_mev_commit_fastrpc)
export const EFFICIENCY_BY_STREAK = `
WITH user_days AS (
  SELECT DISTINCT
    sender,
    DATE(FROM_UNIXTIME(1766015999 + (CAST(block_number AS BIGINT) - 24035770) * 12)) AS d
  FROM mctransactions
  WHERE status IN ('confirmed', 'pre-confirmed') AND block_number > 0
),
numbered AS (
  SELECT sender, d,
    CAST(d AS DATE) - CAST(ROW_NUMBER() OVER (PARTITION BY sender ORDER BY d) AS INTEGER) AS grp
  FROM user_days
),
streaks AS (
  SELECT sender, grp, COUNT(*) AS len, MAX(d) AS last_day
  FROM numbered GROUP BY sender, grp
)
SELECT
  sender AS wallet,
  MAX(len) AS max_streak,
  MAX(CASE WHEN last_day >= CURRENT_DATE - INTERVAL '1' DAY THEN len ELSE 0 END) AS current_streak
FROM streaks
GROUP BY sender
ORDER BY max_streak DESC
LIMIT :limit
`.trim()

// Rising Stars: new users (first swap in last 30 days) ranked by volume
// Only includes "standard" tier wallets (total volume below Bronze threshold)
export const RISING_STARS_NEW_USERS = `
WITH first_swap AS (
  SELECT
    lower(from_address) AS wallet,
    MIN(l1_timestamp) AS first_swap_time
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING MIN(l1_timestamp) >= CURRENT_TIMESTAMP - INTERVAL '30' DAY
),
wallet_stats AS (
  SELECT
    lower(from_address) AS wallet,
    COUNT(*) AS swap_count,
    SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
    SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING SUM(COALESCE(swap_vol_usd, 0)) < 10000
)
SELECT
  f.wallet,
  w.total_swap_vol_usd,
  w.total_swap_vol_eth,
  w.swap_count,
  f.first_swap_time
FROM first_swap f
JOIN wallet_stats w ON f.wallet = w.wallet
ORDER BY w.total_swap_vol_usd DESC
LIMIT :limit
`.trim()

// Rising Stars: week-over-week volume growth percentage
// Only includes "standard" tier wallets (total volume below Bronze threshold)
export const RISING_STARS_WOW_GROWTH = `
WITH total_volume AS (
  SELECT
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_usd, 0)) AS total_vol
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING SUM(COALESCE(swap_vol_usd, 0)) < 10000
),
this_week AS (
  SELECT
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_usd, 0)) AS vol_this_week
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
  GROUP BY lower(from_address)
),
last_week AS (
  SELECT
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_usd, 0)) AS vol_last_week
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '14' DAY
    AND l1_timestamp < CURRENT_TIMESTAMP - INTERVAL '7' DAY
  GROUP BY lower(from_address)
)
SELECT
  t.wallet,
  t.vol_this_week,
  COALESCE(l.vol_last_week, 0) AS vol_last_week,
  CASE
    WHEN COALESCE(l.vol_last_week, 0) > 0
    THEN ((t.vol_this_week - l.vol_last_week) / l.vol_last_week * 100)
    ELSE 100
  END AS wow_growth_pct
FROM this_week t
JOIN total_volume tv ON t.wallet = tv.wallet
LEFT JOIN last_week l ON t.wallet = l.wallet
WHERE t.vol_this_week > 0
ORDER BY wow_growth_pct DESC
LIMIT :limit
`.trim()

// Rising Stars: climbers (biggest absolute volume increase this week vs last)
// Only includes "standard" tier wallets (total volume below Bronze threshold)
export const RISING_STARS_CLIMBERS = `
WITH total_volume AS (
  SELECT
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_usd, 0)) AS total_vol
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING SUM(COALESCE(swap_vol_usd, 0)) < 10000
),
this_week AS (
  SELECT
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_usd, 0)) AS vol_this_week
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
  GROUP BY lower(from_address)
),
last_week AS (
  SELECT
    lower(from_address) AS wallet,
    SUM(COALESCE(swap_vol_usd, 0)) AS vol_last_week
  FROM mevcommit_57173.processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '14' DAY
    AND l1_timestamp < CURRENT_TIMESTAMP - INTERVAL '7' DAY
  GROUP BY lower(from_address)
)
SELECT
  t.wallet,
  t.vol_this_week,
  COALESCE(l.vol_last_week, 0) AS vol_last_week,
  t.vol_this_week - COALESCE(l.vol_last_week, 0) AS vol_increase
FROM this_week t
JOIN total_volume tv ON t.wallet = tv.wallet
LEFT JOIN last_week l ON t.wallet = l.wallet
WHERE t.vol_this_week > 0
ORDER BY vol_increase DESC
LIMIT :limit
`.trim()

// Volume leaders: by largest single swap
export const LEADERBOARD_BY_LARGEST_SWAP = `
SELECT
  lower(from_address) AS wallet,
  MAX(COALESCE(swap_vol_usd, 0)) AS largest_swap_usd,
  MAX(COALESCE(swap_vol_eth, 0)) AS largest_swap_eth,
  COUNT(*) AS swap_count,
  SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
  SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
FROM mevcommit_57173.processed_l1_txns_v2
WHERE is_swap = TRUE
GROUP BY lower(from_address)
HAVING MAX(COALESCE(swap_vol_usd, 0)) > 0
ORDER BY largest_swap_usd DESC
LIMIT :limit
`.trim()

// Users domain
export const GET_USER_SWAP_VOLUME = `
SELECT
  SUM(COALESCE(p.swap_vol_eth, 0)) AS total_swap_vol_eth,
  SUM(COALESCE(p.swap_vol_usd, 0)) AS total_swap_vol_usd
FROM mevcommit_57173.processed_l1_txns_v2 p
WHERE lower(p.from_address) = lower(:addr)
  AND p.is_swap = TRUE
`.trim()

// L1 transactions domain
export const GET_RECENT_L1_SWAP_TX_HASHES = `
SELECT concat('0x', p.l1_tx_hash) AS tx_hash
FROM mevcommit_57173.processed_l1_txns_v2 p
WHERE p.is_swap = TRUE
GROUP BY p.l1_tx_hash
ORDER BY MAX(p.l1_timestamp) DESC
LIMIT :limit
`.trim()

// FastSwap-specific tx hashes for gas estimation.
// Uses fastswap_miles instead of processed_l1_txns_v2 so gas averages
// reflect actual FastSwap transactions, not arbitrary L1 swaps.
export const GET_RECENT_FASTSWAP_TX_HASHES = `
SELECT tx_hash
FROM mevcommit_57173.fastswap_miles
WHERE processed = 1
ORDER BY block_timestamp DESC
LIMIT :limit
`.trim()

// Realized bid cost samples for the dashboard MilesCell proxy.
//
// The indexer writes `surplus` and `gas_cost` immediately but leaves
// `bid_cost` NULL until the sweep finalizer runs, so the dashboard has to
// estimate it on pending rows. Returns realized `bid_cost / 1e18` values
// since 2026-04-08 (the day the bid-cost regime change landed — earlier
// data has 2× higher values and would bias the percentile up).
//
// 7-day window for reactivity: the backend reads real bid costs from chain
// events with zero lag, so a tight window minimizes the frontend lag during
// gas regime shifts. ~30+ swaps/day yields 200+ samples — plenty for p75.
//
// The caller picks p75 — same under-promise philosophy as
// `GET_FASTSWAP_SURPLUS_RATES`. Tight distribution post-fix means a single
// scalar estimate is a reasonable proxy.
export const GET_FASTSWAP_BID_COSTS = `
SELECT CAST(bid_cost AS DOUBLE) / 1e18 AS bid_cost_eth
FROM mevcommit_57173.fastswap_miles
WHERE processed = 1
  AND bid_cost IS NOT NULL
  AND CAST(bid_cost AS DOUBLE) > 0
  AND block_timestamp >= '2026-04-08'
  AND block_timestamp >= NOW() - INTERVAL 7 DAY
`.trim()

// Per-token sweep overhead samples for the upfront miles estimator.
//
// Mirrors the gas-overhead portion of the backend's `costEstimator.Refresh`
// query in `mev-commit/tools/fastswap-miles/cost_estimator.go` line-for-line.
// The cron pairs this with GET_FASTSWAP_SWEEP_BID_BY_TOKEN below and folds
// the sweep-bid contribution into the chosen percentile so the Edge Config
// value matches the backend's combined `PerRowOverhead`. Any backend filter
// change must be mirrored here.
//
// Per-row gas overhead = `surplus_eth − net_profit_eth − bid_cost/1e18`.
// Restricted to ETH-input rows because ERC20-input rows have user_gas baked
// into (surplus_eth − net_profit_eth), and the miles formula deducts
// user_gas separately — including ERC20-input samples here would inflate
// the estimate and double-deduct downstream.
//
// Returns `(output_token, n, p25, p75)` so the cron caller can pick the
// percentile (p25 when `n ≥ 10`, p75 otherwise) per token.
export const GET_FASTSWAP_SWEEP_OVERHEAD_BY_TOKEN = `
SELECT
  output_token,
  COUNT(*) AS n,
  percentile_approx(per_row_oh, 0.25) AS p25,
  percentile_approx(per_row_oh, 0.75) AS p75
FROM (
  SELECT
    output_token,
    surplus_eth - net_profit_eth - CAST(bid_cost AS DOUBLE) / 1e18 AS per_row_oh
  FROM mevcommit_57173.fastswap_miles
  WHERE processed = 1
    AND swap_type = 'erc20'
    AND miles > 0
    AND surplus_eth > 0
    AND surplus_eth IS NOT NULL
    AND surplus_eth < 1.0
    AND input_token = '0x0000000000000000000000000000000000000000'
    AND block_timestamp >= NOW() - INTERVAL 14 DAY
) t
GROUP BY output_token
`.trim()

// Per-token sweep bid contribution (ETH) for the upfront miles estimator.
//
// Mirrors `computePerTokenSweepBidEth` in
// `mev-commit/tools/fastswap-miles/cost_estimator.go`. For each output_token T:
//
//   per_row_sweep_bid_eth(T) = (n_sweeps(T) × global_bid_p75_eth) / n_user_rows(T)
//
// The sweep tx is itself a fastswap so global p75 of `bid_cost/1e18` is
// the right reference population (tight distribution, many samples). p75 =
// under-promise. Cron caller adds this per-row value to the chosen gas
// percentile per token, writes the combined value to Edge Config.
//
// Params: `:executor` (lowercased), `:weth` (lowercased), `:fallback_bid_eth`
// — used by COALESCE when the global percentile subquery returns NULL.
export const GET_FASTSWAP_SWEEP_BID_BY_TOKEN = `
SELECT s.token, s.n_sweeps, u.n_users, COALESCE(b.p, :fallback_bid_eth) AS bid_p75
FROM (
  SELECT LOWER(input_token) AS token, COUNT(*) AS n_sweeps
  FROM mevcommit_57173.fastswap_miles
  WHERE LOWER(user_address) = :executor
    AND swap_type = 'eth_weth'
    AND LOWER(output_token) = :weth
    AND block_timestamp >= NOW() - INTERVAL 14 DAY
  GROUP BY input_token
) s
JOIN (
  SELECT LOWER(output_token) AS token, COUNT(*) AS n_users
  FROM mevcommit_57173.fastswap_miles
  WHERE swap_type = 'erc20'
    AND LOWER(user_address) != :executor
    AND block_timestamp >= NOW() - INTERVAL 14 DAY
  GROUP BY output_token
) u ON u.token = s.token
CROSS JOIN (
  SELECT percentile_approx(CAST(bid_cost AS DOUBLE)/1e18, 0.75) AS p
  FROM mevcommit_57173.fastswap_miles
  WHERE processed = 1
    AND bid_cost IS NOT NULL
    AND CAST(bid_cost AS DOUBLE) > 0
    AND block_timestamp >= NOW() - INTERVAL 14 DAY
) b
`.trim()

// Surplus rate samples for miles estimation.
// Computes `surplus / user_amt_out` — both columns are in the SAME output-token
// units (smallest denomination), so decimals cancel and the ratio is dimensionless.
// That lets us sample across all swap types (eth_weth AND erc20→erc20) without
// per-token decimals handling. The previous version divided by 1e18, which only
// worked for ETH/WETH output and silently excluded all erc20 swaps — about 58%
// of production volume.
// Only includes swaps with positive surplus and output to avoid division by zero.
// Returns individual ratios so the caller can compute a percentile (p25 in the
// consumer, not median — see route handler for rationale).
export const GET_FASTSWAP_SURPLUS_RATES = `
SELECT
  CAST(surplus AS DOUBLE) / CAST(user_amt_out AS DOUBLE) AS surplus_rate
FROM mevcommit_57173.fastswap_miles
WHERE processed = 1
  AND CAST(surplus AS DOUBLE) > 0
  AND CAST(user_amt_out AS DOUBLE) > 0
  AND block_timestamp >= NOW() - INTERVAL 30 DAY
ORDER BY block_timestamp DESC
`.trim()

// FastSwap miles domain
// Recent FastSwap transactions with miles/surplus for a specific user address.
// Used by the dashboard swap history table. Includes both processed=1 (finalized)
// and processed=0 (still calculating) rows so the UI can surface "pending" state
// without the user having to refresh. Supports pagination via LIMIT/OFFSET.
export const GET_USER_RECENT_SWAPS = `
SELECT
  tx_hash,
  block_timestamp,
  swap_type,
  input_token,
  output_token,
  input_amount,
  user_amt_out,
  surplus,
  gas_cost,
  surplus_eth,
  miles,
  processed
FROM mevcommit_57173.fastswap_miles
WHERE lower(user_address) = lower(:address)
ORDER BY block_timestamp DESC
LIMIT :limit OFFSET :offset
`.trim()

// Aggregate stats for a user's FastSwap history — total row count (for
// pagination) and total miles earned across all swaps (for the header chip).
// Combined into one query to avoid an extra round trip; both aggregates scan
// the same rows so the cost is identical to a plain COUNT.
export const GET_USER_RECENT_SWAPS_COUNT = `
SELECT
  COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN processed = 1 THEN miles ELSE 0 END), 0) AS total_miles
FROM mevcommit_57173.fastswap_miles
WHERE lower(user_address) = lower(:address)
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

  // Volume leaders
  "leaderboard/by-largest-swap": LEADERBOARD_BY_LARGEST_SWAP,

  // Efficiency leaders
  "leaderboard/by-txs-per-day": EFFICIENCY_BY_TXS_PER_DAY,
  "leaderboard/by-streak": EFFICIENCY_BY_STREAK,

  // Rising stars
  "leaderboard/rising-new-users": RISING_STARS_NEW_USERS,
  "leaderboard/rising-wow-growth": RISING_STARS_WOW_GROWTH,
  "leaderboard/rising-climbers": RISING_STARS_CLIMBERS,

  // Users domain
  "users/get-user-swap-volume": GET_USER_SWAP_VOLUME,

  // L1 transactions domain
  "l1/get-recent-swap-tx-hashes": GET_RECENT_L1_SWAP_TX_HASHES,
  "fastswap/get-recent-tx-hashes": GET_RECENT_FASTSWAP_TX_HASHES,
  "fastswap/get-surplus-rates": GET_FASTSWAP_SURPLUS_RATES,
  "fastswap/get-sweep-overhead-by-token": GET_FASTSWAP_SWEEP_OVERHEAD_BY_TOKEN,
  "fastswap/get-sweep-bid-by-token": GET_FASTSWAP_SWEEP_BID_BY_TOKEN,
  "fastswap/get-bid-costs": GET_FASTSWAP_BID_COSTS,

  // FastSwap miles domain
  "fastswap/get-user-recent-swaps": GET_USER_RECENT_SWAPS,
  "fastswap/get-user-recent-swaps-count": GET_USER_RECENT_SWAPS_COUNT,

  // Whitelist generation domain
  "whitelist/all-swap-wallets": ALL_SWAP_WALLETS,
  "whitelist/top-by-volume": WHITELIST_TOP_BY_VOLUME,
  "whitelist/top-by-count": WHITELIST_TOP_BY_COUNT,
  "whitelist/top-by-recent-count": WHITELIST_TOP_BY_RECENT_COUNT,
} as const
