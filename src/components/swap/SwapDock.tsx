"use client"

import React from "react"
import { cn } from "@/lib/utils"
import SwapSettings from "./SwapSettings"

interface SwapDockProps {
  isVisible: boolean
  slippage: string
  deadline: number
  onSlippageChange: (slippage: string) => void
  onDeadlineChange: (deadline: number) => void
  isSettingsOpen: boolean
  onSettingsOpenChange: (open: boolean) => void
  isAutoSlippage?: boolean
  onAutoSlippageChange?: (isAuto: boolean) => void
}

export default React.memo(function SwapDock({
  isVisible,
  slippage,
  deadline,
  onSlippageChange,
  onDeadlineChange,
  isSettingsOpen,
  onSettingsOpenChange,
  isAutoSlippage,
  onAutoSlippageChange,
}: SwapDockProps) {
  if (!isVisible) return null

  return (
    <div
      className={cn(
        "relative flex items-center justify-between bg-[#131313] border-x border-t border-white/10 rounded-t-[24px] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden",
        "h-[54px] opacity-100 py-3 px-5 mb-0"
      )}
    >
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

      <div className="flex-1">
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/20">
          Fast Swap
        </span>
      </div>

      <div className="flex-1 flex justify-end">
        <SwapSettings
          slippage={slippage}
          deadline={deadline}
          onSlippageChange={onSlippageChange}
          onDeadlineChange={onDeadlineChange}
          isOpen={isSettingsOpen}
          onOpenChange={onSettingsOpenChange}
          isAutoSlippage={isAutoSlippage}
          onAutoSlippageChange={onAutoSlippageChange}
        />
      </div>
    </div>
  )
})
