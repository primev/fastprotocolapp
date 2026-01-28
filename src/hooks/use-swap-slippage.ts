"use client"

import { useState, useEffect } from "react"

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
    if (savedDeadline) setDeadline(parseInt(savedDeadline, 10))
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
    setDeadline(val)
    localStorage.setItem("swapDeadline", val.toString())
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
