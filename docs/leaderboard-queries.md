# Leaderboard Queries Reference

All leaderboard data comes from `mevcommit_57173.processed_l1_txns_v2` (Trino/Presto) except referrals which use the external Fuul API.

Wallet addresses are always lowercased. Volumes use `COALESCE(..., 0)` for null safety. Timestamps are UTC.

---

## Tier System

Tier filtering is applied via SQL `HAVING` clauses built by `leaderboard-filters.ts`.

| Tier     | Volume Range              |
| -------- | ------------------------- |
| Gold     | >= $1,000,000             |
| Silver   | >= $100,000 < $1,000,000  |
| Bronze   | >= $10,000 < $100,000     |
| Standard | < $10,000 (Rising Stars)  |

---

## API Routes & Queries

### 1. Volume Leaders

**Route**: `GET /api/analytics/leaderboard/volume-leaders`

**Params**: `sort`, `limit`, `tier`, `page`

#### sort=volume (default)

Card preview uses registered query `leaderboard/main-leaderboard`. Paginated mode uses dynamic SQL.

```sql
-- Core aggregation (both modes)
SELECT
  lower(from_address) AS wallet,
  SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
  SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
  COUNT(*) AS swap_count
FROM processed_l1_txns_v2
WHERE is_swap = TRUE
GROUP BY lower(from_address)
HAVING SUM(COALESCE(swap_vol_eth, 0)) > 0
  -- + tier HAVING clause when filtered
ORDER BY total_swap_vol_usd DESC
```

Paginated mode joins CTEs for 24h change calculation:
- `current_24h`: volume in last 24 hours
- `previous_24h`: volume 24-48 hours ago
- `change_24h_pct`: percentage change between the two periods

**Columns**: wallet, total_swap_vol_eth, total_swap_vol_usd, swap_count, swap_vol_eth_24h, swap_vol_usd_24h, change_24h_pct

#### sort=avg_size

Same base query as volume, ordered by `SUM(swap_vol_usd) / NULLIF(COUNT(*), 0) DESC`.

#### sort=largest

```sql
SELECT
  lower(from_address) AS wallet,
  MAX(COALESCE(swap_vol_usd, 0)) AS largest_swap_usd,
  MAX(COALESCE(swap_vol_eth, 0)) AS largest_swap_eth,
  COUNT(*) AS swap_count,
  SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
  SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
FROM processed_l1_txns_v2
WHERE is_swap = TRUE
GROUP BY lower(from_address)
HAVING MAX(COALESCE(swap_vol_usd, 0)) > 0
ORDER BY largest_swap_usd DESC
```

**Columns**: wallet, largest_swap_usd, largest_swap_eth, swap_count, total_swap_vol_usd, total_swap_vol_eth

---

### 2. Efficiency Leaders

**Route**: `GET /api/analytics/leaderboard/efficiency-leaders`

**Params**: `sort`, `limit`, `tier`, `page`

#### sort=tx_count (default)

Main leaderboard sorted by swap count instead of volume.

```sql
SELECT
  lower(from_address) AS wallet,
  SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth,
  SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
  COUNT(*) AS swap_count
FROM processed_l1_txns_v2
WHERE is_swap = TRUE
GROUP BY lower(from_address)
HAVING SUM(COALESCE(swap_vol_eth, 0)) > 0
ORDER BY swap_count DESC
```

#### sort=txs_per_day

```sql
SELECT
  lower(from_address) AS wallet,
  COUNT(*) AS swap_count,
  COUNT(DISTINCT CAST(l1_timestamp AS DATE)) AS active_days,
  CAST(COUNT(*) AS DOUBLE) / COUNT(DISTINCT CAST(l1_timestamp AS DATE)) AS txs_per_day,
  SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
  SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
FROM processed_l1_txns_v2
WHERE is_swap = TRUE
GROUP BY lower(from_address)
HAVING COUNT(DISTINCT CAST(l1_timestamp AS DATE)) >= 1
ORDER BY txs_per_day DESC
```

**Columns**: wallet, swap_count, active_days, txs_per_day, total_swap_vol_usd, total_swap_vol_eth

#### sort=streak

Uses a multi-CTE approach to compute longest consecutive active day streak:

```sql
WITH wallet_days AS (
  -- Distinct active days per wallet
  SELECT lower(from_address) AS wallet, CAST(l1_timestamp AS DATE) AS active_day
  FROM processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address), CAST(l1_timestamp AS DATE)
),
ranked AS (
  -- Assign row numbers for gap detection
  SELECT wallet, active_day,
    ROW_NUMBER() OVER (PARTITION BY wallet ORDER BY active_day) AS rn
  FROM wallet_days
),
streaks AS (
  -- Group consecutive days (same grp = consecutive)
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
)
SELECT ws.wallet, ws.longest_streak, wst.swap_count,
  wst.total_swap_vol_usd, wst.total_swap_vol_eth
FROM wallet_streaks ws
JOIN wallet_stats wst ON ws.wallet = wst.wallet
ORDER BY ws.longest_streak DESC
```

**Columns**: wallet, longest_streak, swap_count, total_swap_vol_usd, total_swap_vol_eth

---

### 3. Rising Stars

**Route**: `GET /api/analytics/leaderboard/rising-stars`

**Params**: `sort`, `limit`, `page`

No tier parameter — all Rising Stars queries are hard-filtered to standard tier (`< $10,000` total volume).

#### sort=new_users

Users whose first swap was within the last 30 days.

```sql
WITH first_swap AS (
  SELECT lower(from_address) AS wallet, MIN(l1_timestamp) AS first_swap_time
  FROM processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING MIN(l1_timestamp) >= CURRENT_TIMESTAMP - INTERVAL '30' DAY
),
wallet_stats AS (
  SELECT lower(from_address) AS wallet,
    COUNT(*) AS swap_count,
    SUM(COALESCE(swap_vol_usd, 0)) AS total_swap_vol_usd,
    SUM(COALESCE(swap_vol_eth, 0)) AS total_swap_vol_eth
  FROM processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING SUM(COALESCE(swap_vol_usd, 0)) < 10000
)
SELECT f.wallet, w.total_swap_vol_usd, w.total_swap_vol_eth,
  w.swap_count, f.first_swap_time
FROM first_swap f JOIN wallet_stats w ON f.wallet = w.wallet
ORDER BY w.total_swap_vol_usd DESC
```

**Columns**: wallet, total_swap_vol_usd, total_swap_vol_eth, swap_count, first_swap_time

#### sort=wow_growth

Week-over-week volume growth percentage.

```sql
WITH total_volume AS (
  -- Standard tier filter
  SELECT lower(from_address) AS wallet
  FROM processed_l1_txns_v2 WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  HAVING SUM(COALESCE(swap_vol_usd, 0)) < 10000
),
this_week AS (
  SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS vol_this_week
  FROM processed_l1_txns_v2
  WHERE is_swap = TRUE AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
  GROUP BY lower(from_address)
),
last_week AS (
  SELECT lower(from_address) AS wallet, SUM(COALESCE(swap_vol_usd, 0)) AS vol_last_week
  FROM processed_l1_txns_v2
  WHERE is_swap = TRUE
    AND l1_timestamp >= CURRENT_TIMESTAMP - INTERVAL '14' DAY
    AND l1_timestamp < CURRENT_TIMESTAMP - INTERVAL '7' DAY
  GROUP BY lower(from_address)
)
SELECT t.wallet, t.vol_this_week, COALESCE(l.vol_last_week, 0),
  CASE WHEN COALESCE(l.vol_last_week, 0) > 0
    THEN ((t.vol_this_week - l.vol_last_week) / l.vol_last_week * 100)
    ELSE 100
  END AS wow_growth_pct
FROM this_week t
JOIN total_volume tv ON t.wallet = tv.wallet
LEFT JOIN last_week l ON t.wallet = l.wallet
WHERE t.vol_this_week > 0
ORDER BY wow_growth_pct DESC
```

**Columns**: wallet, vol_this_week, vol_last_week, wow_growth_pct

#### sort=climbers

Same CTEs as wow_growth but ordered by absolute volume increase.

```sql
ORDER BY (t.vol_this_week - COALESCE(l.vol_last_week, 0)) DESC
```

**Columns**: wallet, vol_this_week, vol_last_week, vol_increase

---

### 4. Referral Leaders

**Route**: `GET /api/fuul/leaderboard`

**Params**: `limit`, `page`, `sort`

**Data source**: External Fuul API (`https://api.fuul.xyz/api/v1/payouts/leaderboard/points`)

Fetches up to 100 entries from Fuul, cached in-memory (30s TTL). Pagination is client-side.

| Sort   | Order By           |
| ------ | ------------------ |
| `refs` | referrals DESC     |
| `miles`| points DESC        |

**Columns**: wallet (trimmed address), points (total_amount), referrals (total_attributions), rank (computed)

---

### 5. Find Me

**Route**: `GET /api/analytics/leaderboard/find-me`

**Params**: `wallet`, `category`, `sort`, `tier`, `pageSize`

Locates a user's rank within a filtered leaderboard using `ROW_NUMBER()`:

```sql
WITH ranked AS (
  SELECT lower(from_address) AS wallet,
    ROW_NUMBER() OVER (ORDER BY <sort_metric> DESC) AS rn
  FROM processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  <tier HAVING clause>
)
SELECT rn FROM ranked WHERE wallet = '<address>'
```

Returns `{ rank, page }` where `page = ceil(rank / pageSize)`, or `{ found: false }` if not present.

Supports categories: `volume`, `efficiency`, `rising`.

---

### 6. User-Specific Queries (Standings Tab)

These registered queries power the user's personal stats on the standings tab:

| Query ID | Purpose | Key Column |
| --- | --- | --- |
| `leaderboard/user-data` | User's volume, swap count, 24h metrics | Single row for `:addr` |
| `leaderboard/user-rank` | User's rank position | `user_rank` (1-indexed) |
| `leaderboard/next-rank-threshold` | Volume of the wallet one rank above | `total_swap_vol_eth/usd` |

---

## Pagination

All paginated queries run a parallel `COUNT(*)` query alongside the data query via `Promise.all`.

Count queries wrap the base aggregation in a subquery (Trino requires an alias):

```sql
SELECT COUNT(*) FROM (
  SELECT lower(from_address) AS wallet
  FROM processed_l1_txns_v2
  WHERE is_swap = TRUE
  GROUP BY lower(from_address)
  <HAVING clause>
) t   -- alias required by Trino
```

Page size: 25 (client default), max 100. Results include `{ entries, pagination: { page, limit, total, totalPages } }`.

---

## Service Layer

| Function | File | Purpose |
| --- | --- | --- |
| `getLeaderboard()` | leaderboard.service.ts | Main leaderboard (registered query) |
| `getLeaderboardByLargestSwap()` | leaderboard.service.ts | Largest swap (registered query) |
| `getEfficiencyByTxsPerDay()` | leaderboard.service.ts | Txs/day (registered query) |
| `getEfficiencyByStreak()` | leaderboard.service.ts | Streak (registered query) |
| `getRisingStarsNewUsers()` | leaderboard.service.ts | New users (registered query) |
| `getRisingStarsWoWGrowth()` | leaderboard.service.ts | WoW growth (registered query) |
| `getRisingStarsClimbers()` | leaderboard.service.ts | Climbers (registered query) |
| `getVolumeLeadersPaginated()` | leaderboard.service.ts | Volume with pagination + tier (dynamic SQL) |
| `getEfficiencyLeadersPaginated()` | leaderboard.service.ts | Efficiency with pagination + tier (dynamic SQL) |
| `getRisingStarsPaginated()` | leaderboard.service.ts | Rising stars with pagination (dynamic SQL) |
| `findUserInLeaderboard()` | leaderboard.service.ts | Find user rank + page (dynamic SQL) |
| `buildTierHavingClause()` | leaderboard-filters.ts | Build HAVING for tier filter |
| `buildCombinedHavingClause()` | leaderboard-filters.ts | Combine tier + existing HAVING |
