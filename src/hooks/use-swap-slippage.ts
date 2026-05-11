"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"

const DEADLINE_MIN_MINUTES = 5
const DEADLINE_MAX_MINUTES = 1440
export const SLIPPAGE_MAX = 50
export const SLIPPAGE_STEP = 0.1
const SLIPPAGE_WARN_THRESHOLD = 5

export const AUTO_BASE_ETH = 0.5
export const AUTO_BASE_PERMIT = 1

/**
 * Headroom added above the observed Barter shortfall in auto mode. This is
 * also the protocol's per-swap surplus capture (= buffer × uniswapAmountOut),
 * so it doubles as the protocol's revenue knob and the safety margin against
 * routing drift between Barter validation and bidder fill. 1.0% currently —
 * 0.5% wasn't enough to absorb observed execution-time drift on small-shortfall
 * swaps and was leaving slippage-too-low reverts.
 */
export const AUTO_BUMP_BUFFER_PCT = 1.0

export type SlippageMode = "auto" | "custom"
export type SlippageWarning = "none" | "high"

interface UseSwapSlippageOptions {
  /** Whether the current swap uses the permit/intent path (ERC20 input). Raises auto base and custom floor to 1%. */
  isPermitPath?: boolean
  /**
   * Observed shortfall percentage from Barter validation. When this exceeds the auto base,
   * auto mode bumps slippage to (shortfall + AUTO_BUMP_BUFFER_PCT) so the trade clears
   * the amount-too-small gate with a small buffer against quote-refresh jitter.
   */
  barterShortfallPct?: number
}

/**
 * Target slippage when auto mode needs to cover an observed Barter shortfall.
 *
 * Linear in the underlying shortfall — `shortfall + buffer` — clamped at
 * SLIPPAGE_MAX. We deliberately do NOT step-round the shortfall before adding
 * the buffer here: stair-stepping the underlying produced an artifact where
 * any positive shortfall (even 0.001%) would push auto from baseline (1.0%)
 * to 1.1%, even though the buffer alone already covered it. The final
 * formatted display value is still 0.1%-aligned via `formatSlippage`, so the
 * user-facing number stays clean.
 *
 * Auto is allowed to ramp up to SLIPPAGE_MAX so the user can see the actual
 * slippage required to execute their swap. The `slippageWarning` derived
 * value flips to "high" above SLIPPAGE_WARN_THRESHOLD (5%) to surface the
 * cost-of-execution as the bump climbs.
 *
 * Exported for testing.
 */
export function computeAutoBumpValue(shortfallPct: number): number {
  const raw = Math.max(0, shortfallPct) + AUTO_BUMP_BUFFER_PCT
  return Math.min(SLIPPAGE_MAX, raw)
}

function clampDeadline(minutes: number): number {
  return Math.max(DEADLINE_MIN_MINUTES, Math.min(DEADLINE_MAX_MINUTES, minutes))
}

/**
 * Format a numeric slippage to step-rounded string (e.g. 0.5, 1, 1.3).
 * Exported for testing.
 */
export function formatSlippage(num: number): string {
  return num === Math.floor(num) ? String(num) : num.toFixed(1)
}

/**
 * Strip invalid characters and collapse multiple decimal points so the input
 * feels natural while typing. Does NOT clamp — user can type any value and we
 * only finalize on blur. Exported for testing.
 */
export function sanitizeInput(val: string): string {
  const cleaned = val.replace(/[^0-9.]/g, "")
  const dotIdx = cleaned.indexOf(".")
  if (dotIdx === -1) return cleaned
  return cleaned.slice(0, dotIdx + 1) + cleaned.slice(dotIdx + 1).replace(/\./g, "")
}

/**
 * Snap a typed value to [min, SLIPPAGE_MAX] with 0.1 step rounding. Runs on blur.
 * Exported for testing.
 */
export function finalizeSlippage(val: string, min: number): string {
  const num = parseFloat(val)
  if (Number.isNaN(num)) return formatSlippage(min)
  const rounded = Math.round(num / SLIPPAGE_STEP) * SLIPPAGE_STEP
  const clamped = Math.max(min, Math.min(SLIPPAGE_MAX, rounded))
  return formatSlippage(clamped)
}

/**
 * Compute the slippage value auto mode would surface given the observed
 * Barter shortfall and the path-dependent auto base. Mirrors the inline
 * logic inside `useSwapSlippage` — exported for testing.
 */
export function computeAutoSlippage(
  barterShortfallPct: number,
  isPermitPath: boolean
): { slippage: string; bumped: boolean } {
  const autoBase = isPermitPath ? AUTO_BASE_PERMIT : AUTO_BASE_ETH
  const baseline = Math.max(autoBase, AUTO_BUMP_BUFFER_PCT)
  const bump = computeAutoBumpValue(barterShortfallPct)
  const value = Math.max(autoBase, bump)
  return { slippage: formatSlippage(value), bumped: bump > baseline }
}

export function useSwapSlippage(options: UseSwapSlippageOptions = {}) {
  const { isPermitPath = false, barterShortfallPct = 0 } = options

  const [mode, setMode] = useState<SlippageMode>("auto")
  const [customSlippage, setCustomSlippage] = useState<string>(String(AUTO_BASE_ETH))
  const [deadline, setDeadline] = useState(30)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const savedDeadline = localStorage.getItem("swapDeadline")
    if (savedDeadline) {
      const parsed = parseInt(savedDeadline, 10)
      if (!Number.isNaN(parsed)) setDeadline(clampDeadline(parsed))
    }
    setIsMounted(true)
  }, [])

  const autoBase = isPermitPath ? AUTO_BASE_PERMIT : AUTO_BASE_ETH
  const customMin = autoBase

  // Auto mode: slippage is always max(autoBase, observed shortfall + buffer).
  // The buffer above shortfall absorbs execution-time drift between when
  // Barter validated and when the bidder fills — without it, a swap with
  // shortfall just under autoBase (say 0.3% vs 0.5%) submits with autoBase
  // and reverts as soon as routing drifts.
  //
  // Baseline = the auto-mode value when no shortfall is observed. With the
  // buffer raised to 1.0, the baseline for ETH input is `buffer` (1.0), not
  // autoBase (0.5) — and that 1.0 IS the default the user sees. The
  // "auto-bumped" UI badge should only fire when an actual shortfall pushes
  // slippage *above* this baseline; otherwise the default state shows a
  // misleading "custom" badge next to the gear.
  const bumpedFromShortfall = computeAutoBumpValue(barterShortfallPct)
  const autoBaseline = Math.max(autoBase, AUTO_BUMP_BUFFER_PCT)
  const autoBumpedForGas = mode === "auto" && bumpedFromShortfall > autoBaseline
  const autoSlippage = formatSlippage(Math.max(autoBase, bumpedFromShortfall))

  // Re-clamp custom value when the floor rises (e.g. user switches from ETH input to ERC20 input).
  // IMPORTANT: do not depend on customSlippage here — doing so re-runs on every keystroke and
  // immediately rewrites partial/below-floor input ("0.", "0", empty), making typing impossible.
  useEffect(() => {
    if (mode !== "custom") return
    setCustomSlippage((prev) => {
      const num = parseFloat(prev)
      if (!Number.isNaN(num) && num < customMin) return formatSlippage(customMin)
      return prev
    })
  }, [mode, customMin])

  const slippage = useMemo(() => {
    if (mode === "auto") return autoSlippage
    return customSlippage
  }, [mode, autoSlippage, customSlippage])

  const updateSlippage = useCallback((val: string) => {
    setMode("custom")
    setCustomSlippage(sanitizeInput(val))
  }, [])

  const commitSlippage = useCallback(() => {
    // Only meaningful in custom mode. Safe to call from multiple triggers (blur + popover close).
    if (mode !== "custom") return
    const trimmed = customSlippage.trim()
    const num = parseFloat(trimmed)
    // Empty or unparseable → revert to auto mode so we don't strand the user on
    // a stale/invalid custom value after they dismiss the popover.
    if (trimmed === "" || Number.isNaN(num)) {
      setMode("auto")
      setCustomSlippage(formatSlippage(customMin))
      return
    }
    setCustomSlippage(finalizeSlippage(trimmed, customMin))
  }, [mode, customSlippage, customMin])

  const resetSlippage = () => {
    setMode("auto")
  }

  // When the user flips back to auto, drop the stored custom value so the next
  // custom-mode entry starts from the current auto baseline rather than
  // restoring whatever was typed before. Without this, custom remembers the
  // last value across an auto round-trip — surprising when auto's own value
  // has shifted in the meantime (calc-applied bumps, gas changes, etc.).
  const prevModeRef = useRef(mode)
  useEffect(() => {
    if (prevModeRef.current === "custom" && mode === "auto") {
      setCustomSlippage(autoSlippage)
    }
    prevModeRef.current = mode
  }, [mode, autoSlippage])

  const updateDeadline = (val: number) => {
    const num = Number(val)
    if (Number.isNaN(num)) return
    const clamped = clampDeadline(num)
    setDeadline(clamped)
    localStorage.setItem("swapDeadline", String(clamped))
  }

  // Warning fires on the effective slippage regardless of mode so an
  // auto-bump above the threshold is still transparent to the user.
  const slippageWarning: SlippageWarning = useMemo(() => {
    const num = parseFloat(slippage)
    if (Number.isNaN(num)) return "none"
    return num > SLIPPAGE_WARN_THRESHOLD ? "high" : "none"
  }, [slippage])

  return {
    slippage,
    mode,
    setMode,
    customMin,
    autoBase,
    autoBumpedForGas,
    deadline,
    updateSlippage,
    commitSlippage,
    resetSlippage,
    updateDeadline,
    isMounted,
    slippageWarning,
  }
}
