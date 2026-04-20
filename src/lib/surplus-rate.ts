/**
 * Shared types and helpers for the size-bucketed surplus-rate estimator.
 *
 * The miles estimator used a single population-wide surplus rate (~0.56%),
 * which is the p25 of a bimodal distribution. Small swaps empirically capture
 * ~2% and large swaps ~0.5%, so the single number penalized small swaps so
 * hard that gas ate the whole pot and users saw 0 miles even though those
 * swaps do earn miles at settlement.
 *
 * Replaced with three bucket rates chosen by output size (in ETH). The cron
 * computes the thresholds (data-driven tertiles) and the per-bucket p50 rate
 * daily and writes both to Edge Config; consumers pick a bucket per-swap via
 * `pickSurplusRate()`.
 */

export interface SurplusBuckets {
  /**
   * Upper boundary of the small and medium buckets, in ETH.
   * `thresholds[0]` splits small from medium, `thresholds[1]` splits medium
   * from large.
   */
  thresholds: [number, number]
  /** p50 of realized `surplus / user_amt_out` within each bucket. */
  rates: {
    small: number
    medium: number
    large: number
  }
}

/**
 * Static fallback used when Edge Config hasn't been populated yet or the
 * bucketed read fails. Rates roughly reflect the bimodal clusters observed in
 * the 2026-04 sample (~2% small, ~1% medium, ~0.5% large); thresholds are the
 * round numbers closest to the observed tertile splits on that sample.
 * Cron populates real values daily.
 */
export const DEFAULT_SURPLUS_BUCKETS: SurplusBuckets = {
  thresholds: [0.02, 0.1],
  rates: { small: 0.02, medium: 0.01, large: 0.0056 },
}

/**
 * Picks the surplus rate that matches a swap's output size in ETH.
 *
 * Ranges are half-open so boundary swaps land in the larger bucket:
 *   outputEth <  thresholds[0] → small
 *   outputEth <  thresholds[1] → medium
 *   otherwise                  → large
 */
export function pickSurplusRate(outputEth: number, buckets: SurplusBuckets): number {
  if (!Number.isFinite(outputEth) || outputEth <= 0) return buckets.rates.medium
  if (outputEth < buckets.thresholds[0]) return buckets.rates.small
  if (outputEth < buckets.thresholds[1]) return buckets.rates.medium
  return buckets.rates.large
}

/**
 * Type guard — validates data shape before we trust values pulled from Edge
 * Config. Returns `false` for anything that isn't the expected structure with
 * all positive numeric fields.
 */
export function isSurplusBuckets(value: unknown): value is SurplusBuckets {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.thresholds) || v.thresholds.length !== 2) return false
  const [t0, t1] = v.thresholds
  if (typeof t0 !== "number" || typeof t1 !== "number" || t0 <= 0 || t1 <= t0) return false

  const rates = v.rates as Record<string, unknown> | undefined
  if (!rates || typeof rates !== "object") return false
  const { small, medium, large } = rates
  if (typeof small !== "number" || small <= 0) return false
  if (typeof medium !== "number" || medium <= 0) return false
  if (typeof large !== "number" || large <= 0) return false
  return true
}
