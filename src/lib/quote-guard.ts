/**
 * Pure helpers for the quote-guard fallback.
 *
 * When Barter's routed output diverges from the Uniswap single-hop quote by more than a
 * configured threshold, the Uniswap number is not a trustworthy anchor for user protection
 * (thin direct pools, multihop routing materially beats single-hop). In that case the
 * protective floor — the `userAmtOut` signed into the Permit2 intent — is derived from
 * Barter's output minus a configurable treasury margin instead.
 *
 * Split out of `use-swap-form.ts` so the logic is unit-testable without booting React.
 */

/**
 * Returns true when Barter's routed output exceeds the Uniswap quote by more than the
 * configured divergence threshold.
 *
 * Guard stays off when:
 *   - Either input is missing / non-positive
 *   - `divergenceThresholdPct` is zero or negative (misconfigured; fail closed)
 *   - Barter ≤ Uniswap × (1 + threshold/100)
 */
export function isQuoteGuardTriggered(
  uniswapAmountOut: bigint | undefined,
  barterAmountOut: bigint | undefined,
  divergenceThresholdPct: number
): boolean {
  if (!uniswapAmountOut || uniswapAmountOut <= 0n) return false
  if (!barterAmountOut || barterAmountOut <= 0n) return false
  if (!(divergenceThresholdPct > 0)) return false
  if (!Number.isFinite(divergenceThresholdPct)) return false
  const thresholdBps = BigInt(Math.floor(divergenceThresholdPct * 100))
  const trigger = (uniswapAmountOut * (10000n + thresholdBps)) / 10000n
  return barterAmountOut > trigger
}

/**
 * Returns the protective floor to sign into the intent when the guard fires.
 *
 *   floor = barterAmountOut × (1 − treasuryMarginPct / 100)
 *
 * `treasuryMarginPct` is clamped to ≥ 0 (a negative margin would pay the user more than
 * Barter returns, which the settlement contract cannot honour).
 */
export function computeQuoteGuardFloor(barterAmountOut: bigint, treasuryMarginPct: number): bigint {
  const safeMargin = Number.isFinite(treasuryMarginPct) ? Math.max(0, treasuryMarginPct) : 0
  const marginBps = BigInt(Math.floor(safeMargin * 100))
  return (barterAmountOut * (10000n - marginBps)) / 10000n
}
