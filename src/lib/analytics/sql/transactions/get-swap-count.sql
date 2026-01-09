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

