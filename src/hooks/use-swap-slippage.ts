"use client"

import { useState, useEffect } from "react"

const DEADLINE_MIN_MINUTES = 5
const DEADLINE_MAX_MINUTES = 1440
const SLIPPAGE_MIN = 0
const SLIPPAGE_MAX = 2
const DEFAULT_SLIPPAGE = "0.5"

function clampDeadline(minutes: number): number {
  return Math.max(DEADLINE_MIN_MINUTES, Math.min(DEADLINE_MAX_MINUTES, minutes))
}

/** Round to 0.1 increments (0.1, 0.2, etc.) - no finer precision like 0.001 */
const SLIPPAGE_STEP = 0.1

function clampSlippage(val: string): string {
  const cleaned = val.replace(/[^0-9.]/g, "")
  if (cleaned === "" || cleaned === ".") return cleaned
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return cleaned
  // Allow trailing dot for typing (e.g. "0." when typing "0.1")
  if (cleaned.endsWith(".") && num >= SLIPPAGE_MIN && num <= SLIPPAGE_MAX) return cleaned
  // Round to 0.1 step, clamp to 0-2%
  const rounded = Math.round(num / SLIPPAGE_STEP) * SLIPPAGE_STEP
  const clamped = Math.max(SLIPPAGE_MIN, Math.min(SLIPPAGE_MAX, rounded))
  return clamped === Math.floor(clamped) ? String(clamped) : clamped.toFixed(1)
}

export function useSwapSlippage() {
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE)
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

  const updateSlippage = (val: string) => {
    const clamped = clampSlippage(val)
    setSlippage(clamped)
  }

  const resetSlippage = () => {
    setSlippage(DEFAULT_SLIPPAGE)
  }

  const updateDeadline = (val: number) => {
    const num = Number(val)
    if (Number.isNaN(num)) return
    const clamped = clampDeadline(num)
    setDeadline(clamped)
    localStorage.setItem("swapDeadline", String(clamped))
  }

  return {
    slippage,
    deadline,
    updateSlippage,
    resetSlippage,
    updateDeadline,
    isMounted,
  }
}
