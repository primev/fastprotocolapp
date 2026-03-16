# Leaderboard Queries Reference

All leaderboard data comes from `mevcommit_57173.processed_l1_txns_v2` (Trino/Presto) except referrals which use the external Fuul API.

Wallet addresses are always lowercased. Volumes use `COALESCE(..., 0)` for null safety. Timestamps are UTC.

---

## Tier System

Tier filtering is applied via SQL `HAVING` clauses built by `leaderboard-filters.ts`.

### Major Tiers

| Tier     | Volume Range              |
| -------- | ------------------------- |
| Gold     | >= $1,000,000             |
| Silver   | >= $100,000 < $1,000,000  |
| Bronze   | >= $10,000 < $100,000     |
| Standard | < $10,000 (Rising Stars)  |

### Sub-Tiers

Each major tier has 4 sub-tiers (defined in `constants.ts` via `SUB_TIERS`). Sub-tiers are display-only — they do not affect SQL filtering.

| Tier   | Sub-Tier    | Threshold    |
| ------ | ----------- | ------------ |
| Gold   | Instant     | $10,000,000  |
| Gold   | Lightspeed  | $5,000,000   |
| Gold   | Hypersonic  | $2,500,000   |
| Gold   | Sonic       | $1,000,000   |
| Silver | Thunder     | $500,000     |
| Silver | Blitz       | $300,000     |
| Silver | Bolt        | $175,000     |
| Silver | Flash       | $100,000     |
| Bronze | Storm       | $75,000      |
| Bronze | Streak      | $50,000      |
| Bronze | Surge       | $25,000      |
| Bronze | Spark       | $10,000      |

Helper functions: `getSubTierFromVolume(volume)` returns current sub-tier, `getNextSubTier(volume)` returns next milestone.

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

Uses a multi-CTE approach on `mctransactions` (fastrpc catalog) to compute longest consecutive active day streak and current streak. Block numbers are converted to dates via `DATE(TO_TIMESTAMP(1766015999 + (block_number - 24035770) * 12))`.

```sql
WITH user_days AS (
  SELECT DISTINCT
    sender,
    DATE(TO_TIMESTAMP(1766015999 + (block_number - 24035770) * 12)) AS d
  FROM mctransactions
  WHERE status IN ('confirmed', 'pre-confirmed') AND block_number > 0
),
numbered AS (
  SELECT sender, d, d - (ROW_NUMBER() OVER (PARTITION BY sender ORDER BY d))::int AS grp
  FROM user_days
),
streaks AS (
  SELECT sender, grp, COUNT(*) AS len, MAX(d) AS last_day
  FROM numbered GROUP BY sender, grp
)
SELECT
  sender AS wallet,
  MAX(len) AS max_streak,
  MAX(CASE WHEN last_day >= CURRENT_DATE - 1 THEN len ELSE 0 END) AS current_streak
FROM streaks
GROUP BY sender
ORDER BY max_streak DESC
```

**Catalog**: `fastrpc` (`pg_mev_commit_fastrpc.public`)

**Columns**: wallet, max_streak, current_streak

**Note**: Tier filtering is not applied for streak queries because `mctransactions` is in a different catalog than `processed_l1_txns_v2`, making cross-catalog joins impractical.

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

### 4. Referral Leaders (Miles)

**Route**: `GET /api/fuul/leaderboard`

**Params**: `limit`, `page`, `sort`

**Data source**: External Fuul API (`https://api.fuul.xyz/api/v1/payouts/leaderboard/payouts`)

Fetches up to 100 entries from Fuul, cached in-memory (30s TTL). Pagination is client-side.

| Sort   | Order By           |
| ------ | ------------------ |
| `refs` | referrals DESC     |
| `miles`| points DESC        |

**Columns**: wallet (trimmed address), points (total_amount), referrals (total_attributions), rank (computed)

---

### 4a. Squads — Top Squads

**Route**: `GET /api/fuul/squads`

**Params**: `limit` (default 10, max 25)

**Data sources**: Fuul leaderboard API + Fuul by-referrer API + BigQuery

**Cache**: In-memory, 5-minute TTL

Flow:
1. Fetch top 25 affiliates from Fuul leaderboard (sorted by `total_attributions`)
2. For each affiliate, call `GET /api/v1/payouts/by-referrer?user_identifier={address}&user_identifier_type=evm_address` to get referred wallet addresses (batched 5 at a time)
3. Collect all referred wallets and run a single BigQuery query to get swap volumes
4. Aggregate volume per squad (sum of referred wallets' swap volumes)

**Response**: `{ success, squads: [{ leader, leaderFull, members, squadVolume, squadVolumeEth, miles }] }`

### 4b. Squads — My Squad

**Route**: `GET /api/fuul/squads/my-squad`

**Params**: `address` (required, wallet address)

**Data sources**: Fuul by-referrer API + BigQuery

**Cache**: In-memory per wallet, 2-minute TTL

Flow:
1. Call Fuul `by-referrer` for the given address to get referred wallets
2. Query BigQuery for each referred wallet's swap volume, swap count, and last swap timestamp
3. Active status: any swap within last 7 days = "Active", otherwise "Inactive"

**Response**: `{ success, members: [{ wallet, walletFull, status, swapVolume, swapVolumeEth, swapCount }], totalVolume, totalVolumeEth, activeCount, totalCount }`

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

### Squads

| Function / Route | File | Purpose |
| --- | --- | --- |
| `GET /api/fuul/squads` | app/api/fuul/squads/route.ts | Top squads (Fuul leaderboard + by-referrer + BigQuery, 5m cache) |
| `GET /api/fuul/squads/my-squad` | app/api/fuul/squads/my-squad/route.ts | User's squad members + volumes (Fuul by-referrer + BigQuery, 2m cache) |

### Tier & Sub-Tier Helpers

| Function | File | Purpose |
| --- | --- | --- |
| `getTierFromVolume()` | constants.ts | Major tier from volume |
| `getSubTierFromVolume()` | constants.ts | Current sub-tier from volume |
| `getNextSubTier()` | constants.ts | Next sub-tier milestone |
| `getNextTier()` | constants.ts | Next major tier threshold |

### UI Components

| Component | File | Purpose |
| --- | --- | --- |
| `SquadsCard` | components/dashboard/SquadsCard.tsx | My Squad + Top Squads card (replaces ReferralLeadersCard in Stats grid) |
