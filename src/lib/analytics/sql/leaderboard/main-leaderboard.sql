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

