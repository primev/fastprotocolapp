import { slippageBpsFromPercent, SLIPPAGE_MAX_PCT } from "./slippage"

// Pure math for picking the effective slippage percent that gets applied to
// a Uniswap quote when Barter validation reports a shortfall. Extracted from
// use-swap-form.ts so it can be property-tested without React; the hook just
// reads UI state + config flags and passes them through.
//
// The rule, in words: start with the user's slippage tolerance from the UI.
// If Barter observed that its routed output fell short of the Uniswap quote
// by more than that, we raise the floor to Barter's shortfall plus a safety
// buffer — otherwise the Uniswap-derived `minAmountOut` won't actually be
// achievable when the settlement contract swaps through Barter. Cap at 2%
// regardless; that's the contract-level ceiling we won't exceed.
//
// Numbers are percents (0.5 = 0.5%), not bps, because that's how the UI
// stores them. The bps conversion happens at the boundary.

export const DEFAULT_BARTER_BUFFER_PCT = 0.5

export type ComputeAppliedSlippageParams = {
  /** User-selected slippage tolerance, as a percent (e.g. 0.5 for 0.5%). */
  userSlippagePct: number
  /**
   * Barter's reported shortfall between its routed output and the Uniswap
   * quote, also as a percent. Zero or negative means "no shortfall"; the
   * Barter floor only activates when this is positive.
   */
  barterShortfallPct: number
  /**
   * Safety buffer added on top of the Barter shortfall. Default 0.5%. Exists
   * so the floor is reliably clearable on the first click — Barter's
   * routing can drift by a few bps between the validation call and the
   * actual settlement.
   */
  barterBufferPct?: number
  /**
   * Upper bound on the effective slippage. Default matches
   * `SLIPPAGE_MAX_PCT` (50%) from the shared slippage module, but
   * `use-swap-form` caps at 2% by convention — callers pass that in.
   */
  maxSlippagePct?: number
}

/**
 * Compute the applied-slippage percent. The output is the final percent
 * the caller should use to derive `minAmountOut`; pass it to
 * `slippageBpsFromPercent` or directly to `computeSlippageLimit`.
 *
 * Invariants (see tests/lib/swap/min-amount-out.test.ts):
 *  - Output is in the inclusive range [0, maxSlippagePct].
 *  - Output is never less than `userSlippagePct` (when user is ≤ max).
 *  - When `barterShortfallPct > 0`, output ≥ `barterShortfallPct + buffer`
 *    (also capped at max).
 *  - Monotone non-decreasing in `barterShortfallPct` (more shortfall →
 *    looser slippage, up to the cap).
 */
export function computeAppliedSlippagePct(params: ComputeAppliedSlippageParams): number {
  const {
    userSlippagePct,
    barterShortfallPct,
    barterBufferPct = DEFAULT_BARTER_BUFFER_PCT,
    maxSlippagePct = SLIPPAGE_MAX_PCT,
  } = params

  // Guard NaN / negative input — the UI can send either mid-typing.
  const user = Number.isFinite(userSlippagePct) && userSlippagePct > 0 ? userSlippagePct : 0
  const shortfall =
    Number.isFinite(barterShortfallPct) && barterShortfallPct > 0 ? barterShortfallPct : 0

  // Barter floor activates only when there's a positive shortfall; otherwise
  // zero so the user's tolerance wins.
  const barterFloor = shortfall > 0 ? shortfall + barterBufferPct : 0

  return Math.min(maxSlippagePct, Math.max(user, barterFloor))
}

/**
 * Same as `computeAppliedSlippagePct`, but hands back the bps form that
 * `computeSlippageLimit` wants (bigint). Most callers use this because
 * the next step is always bps-space arithmetic.
 */
export function computeAppliedSlippageBps(params: ComputeAppliedSlippageParams): bigint {
  return slippageBpsFromPercent(computeAppliedSlippagePct(params))
}
