"use client"

import { useState, useEffect } from "react"

// Same range as use-swap-confirmation and use-swap-intent (minutes)
const DEADLINE_MIN_MINUTES = 5
const DEADLINE_MAX_MINUTES = 1440

function clampDeadline(minutes: number): number {
  return Math.max(DEADLINE_MIN_MINUTES, Math.min(DEADLINE_MAX_MINUTES, minutes))
}

export function useSwapSlippage() {
  const [slippage, setSlippage] = useState("0.5")
  const [isAutoSlippage, setIsAutoSlippage] = useState(false)
  const [deadline, setDeadline] = useState(30)

  // Initialize from localStorage
  useEffect(() => {
    const savedSlippage = localStorage.getItem("swapSlippage")
    const savedAuto = localStorage.getItem("swapSlippageAuto")
    const savedDeadline = localStorage.getItem("swapDeadline")

    if (savedSlippage) setSlippage(savedSlippage)
    if (savedAuto) setIsAutoSlippage(savedAuto === "true")
    if (savedDeadline) {
      const parsed = parseInt(savedDeadline, 10)
      if (!Number.isNaN(parsed)) setDeadline(clampDeadline(parsed))
    }
  }, [])

  const updateSlippage = (val: string) => {
    setSlippage(val)
    localStorage.setItem("swapSlippage", val)
  }

  const updateAutoSlippage = (val: boolean) => {
    setIsAutoSlippage(val)
    localStorage.setItem("swapSlippageAuto", val.toString())
  }

  const updateDeadline = (val: number) => {
    const clamped = clampDeadline(val)
    setDeadline(clamped)
    localStorage.setItem("swapDeadline", clamped.toString())
  }

  return {
    slippage,
    isAutoSlippage,
    deadline,
    updateSlippage,
    updateAutoSlippage,
    updateDeadline,
  }
}
