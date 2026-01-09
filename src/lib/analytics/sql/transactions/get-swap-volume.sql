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

