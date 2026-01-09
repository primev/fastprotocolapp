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

