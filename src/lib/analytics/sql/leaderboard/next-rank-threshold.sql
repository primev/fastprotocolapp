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

