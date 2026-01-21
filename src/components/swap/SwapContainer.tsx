"use client"

import { useState } from "react"
import SwapInterface from "./SwapInterface"
import { INTENT_DEADLINE_MINUTES } from "@/lib/swap-constants"

interface SwapContainerProps {
  onGetStarted?: () => void
}

export default function SwapContainer({ onGetStarted }: SwapContainerProps) {
  // Settings state with localStorage persistence
  const [slippage, setSlippage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("swapSlippage") || "0.5"
    }
    return "0.5"
  })
  const [deadline, setDeadline] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("swapDeadline")
      return saved ? parseInt(saved, 10) : INTENT_DEADLINE_MINUTES
    }
    return INTENT_DEADLINE_MINUTES
  })

  return (
    <div className="w-full max-w-[500px] flex flex-col gap-4">
      {/* SWAP INTERFACE */}
      <SwapInterface
        onGetStarted={onGetStarted}
        slippage={slippage}
        deadline={deadline}
        onSlippageChange={setSlippage}
        onDeadlineChange={setDeadline}
      />
    </div>
  )
}
