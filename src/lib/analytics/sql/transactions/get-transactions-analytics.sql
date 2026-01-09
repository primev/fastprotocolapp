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

