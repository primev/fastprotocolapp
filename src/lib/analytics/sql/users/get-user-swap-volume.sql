SELECT
  SUM(COALESCE(p.swap_vol_eth, 0)) AS total_swap_vol_eth
FROM mevcommit_57173.processed_l1_txns_v2 p
WHERE lower(p.from_address) = lower(:addr)
  AND p.is_swap = TRUE

