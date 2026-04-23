"use client"

import { useState, useEffect, useMemo, useCallback } from "react"

const DEADLINE_MIN_MINUTES = 5
const DEADLINE_MAX_MINUTES = 1440
export const SLIPPAGE_MAX = 50
const SLIPPAGE_STEP = 0.1
const SLIPPAGE_WARN_THRESHOLD = 5

const AUTO_BASE_ETH = 0.5
const AUTO_BASE_PERMIT = 1

export type SlippageMode = "auto" | "custom"
export type SlippageWarning = "none" | "high"

interface UseSwapSlippageOptions {
  /** Whether the current swap uses the permit/intent path (ERC20 input). Raises auto base and custom floor to 1%. */
  isPermitPath?: boolean
  /**
   * Observed shortfall percentage from Barter validation. When this exceeds the auto base,
   * auto mode bumps slippage to 2% to cover gas costs.
   */
  barterShortfallPct?: number
}

function clampDeadline(minutes: number): number {
  return Math.max(DEADLINE_MIN_MINUTES, Math.min(DEADLINE_MAX_MINUTES, minutes))
}

/** Format a numeric slippage to step-rounded string (e.g. 0.5, 1, 1.3). */
function formatSlippage(num: number): string {
  return num === Math.floor(num) ? String(num) : num.toFixed(1)
}

/**
 * Strip invalid characters and collapse multiple decimal points so the input
 * feels natural while typing. Does NOT clamp — user can type any value and we
 * only finalize on blur.
 */
function sanitizeInput(val: string): string {
  const cleaned = val.replace(/[^0-9.]/g, "")
  const dotIdx = cleaned.indexOf(".")
  if (dotIdx === -1) return cleaned
  return cleaned.slice(0, dotIdx + 1) + cleaned.slice(dotIdx + 1).replace(/\./g, "")
}

/** Snap a typed value to [min, SLIPPAGE_MAX] with 0.1 step rounding. Runs on blur. */
function finalizeSlippage(val: string, min: number): string {
  const num = parseFloat(val)
  if (Number.isNaN(num)) return formatSlippage(min)
  const rounded = Math.round(num / SLIPPAGE_STEP) * SLIPPAGE_STEP
  const clamped = Math.max(min, Math.min(SLIPPAGE_MAX, rounded))
  return formatSlippage(clamped)
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

  // Auto mode: bump to 2% when Barter's observed shortfall exceeds the auto base.
  // The existing computedMinAmountOut logic in useSwapForm already takes max(user, shortfall+0.5),
  // so this flag primarily drives the *visible* slippage value and the review-page note.
  const autoBumpedForGas = mode === "auto" && barterShortfallPct > autoBase
  const autoSlippage = autoBumpedForGas ? formatSlippage(2) : formatSlippage(autoBase)

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

  const updateDeadline = (val: number) => {
    const num = Number(val)
    if (Number.isNaN(num)) return
    const clamped = clampDeadline(num)
    setDeadline(clamped)
    localStorage.setItem("swapDeadline", String(clamped))
  }

  const slippageWarning: SlippageWarning = useMemo(() => {
    if (mode !== "custom") return "none"
    const num = parseFloat(customSlippage)
    if (Number.isNaN(num)) return "none"
    return num > SLIPPAGE_WARN_THRESHOLD ? "high" : "none"
  }, [mode, customSlippage])

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
