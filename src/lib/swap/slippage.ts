// Pure slippage math. Extracted from use-swap-quote.ts so it can be
// unit- and property-tested without mounting React or viem. These values
// are passed to the settlement contract as the minAmountOut / maxAmountIn
// guard — a regression here is a direct user loss, so we pin every case.
//
// Units:
//   - Percent: human-facing, 0..50 (post-validation).
//   - BPS (basis points): contract-side, 1 bp = 0.01%. 10_000 bps = 100%.
//
// `BPS_DENOM` is the integer divisor we use so all arithmetic stays in
// bigint land — no floating-point drift at the wei level, even for
// 18-decimal tokens with amounts north of 2^64.

export const BPS_DENOM = 10_000n
export const SLIPPAGE_MAX_PCT = 50
export const SLIPPAGE_DEFAULT_PCT = 0.5

export type TradeType = "exactIn" | "exactOut"

/**
 * Validate and clamp a slippage string from the UI.
 *
 * - NaN, negative, or empty → falls back to the default (0.5%).
 * - Values above 50% are capped at 50% (matches the contract's guard).
 *
 * Returns a percent in the inclusive range [0, 50].
 */
export function validateSlippage(slippage: string): number {
  const num = parseFloat(slippage)
  if (isNaN(num) || num < 0) return SLIPPAGE_DEFAULT_PCT
  if (num > SLIPPAGE_MAX_PCT) return SLIPPAGE_MAX_PCT
  return num
}

/**
 * Convert a validated percent (0..50) into a bigint bps value (0..5_000).
 *
 * We floor rather than round so we never OVER-spend a user's slippage
 * tolerance — a half-bp of extra tolerance is worth less than the
 * guarantee that the on-chain check matches the UI display.
 */
export function slippageBpsFromPercent(pct: number): bigint {
  const clamped = Math.max(0, Math.min(SLIPPAGE_MAX_PCT, pct))
  return BigInt(Math.floor(clamped * 100))
}

/**
 * Compute the slippage-adjusted contract-side limit from a raw quote.
 *
 * For `exactIn` trades, `amount` is amountOut and we emit a floor
 * (the minimum output the user is willing to accept):
 *     limit = amount * (10_000 - bps) / 10_000
 *
 * For `exactOut` trades, `amount` is amountIn and we emit a ceiling
 * (the maximum input the user is willing to pay):
 *     limit = amount * (10_000 + bps) / 10_000
 *
 * The division is integer bigint math — the result may round DOWN for
 * exactIn (which is correct: a more conservative minimum) and DOWN for
 * exactOut (a tighter ceiling than the precise real-number value, which
 * is again safer for the user).
 */
export function computeSlippageLimit(amount: bigint, bps: bigint, tradeType: TradeType): bigint {
  if (tradeType === "exactIn") {
    return (amount * (BPS_DENOM - bps)) / BPS_DENOM
  }
  return (amount * (BPS_DENOM + bps)) / BPS_DENOM
}
