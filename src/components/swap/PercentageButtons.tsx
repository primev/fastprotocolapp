"use client"

import React from "react"
import { formatUnits } from "viem"
import { cn } from "@/lib/utils"
import type { Token } from "@/types/swap"
import type { UseBalanceReturnType } from "wagmi"

interface PercentageButtonsProps {
  balance: UseBalanceReturnType["data"]
  token: Token | undefined
  isConnected: boolean
  onSelect: (percentage: string) => void
}

export default React.memo(function PercentageButtons({
  balance,
  token,
  isConnected,
  onSelect,
}: PercentageButtonsProps) {
  if (!isConnected || !balance || !token) {
    return null
  }

  const handlePercentageClick = (pct: string) => {
    const balanceValue = parseFloat(formatUnits(balance.value, token.decimals))
    if (pct === "Max") {
      onSelect(balanceValue.toString())
    } else {
      const percent = parseFloat(pct) / 100
      const amountValue = balanceValue * percent
      onSelect(amountValue.toString())
    }
  }

  return (
    <div
      className={cn(
        "flex gap-1.5 transition-opacity duration-200",
        "opacity-0 group-hover:opacity-100 h-[30px]"
      )}
    >
      {["25%", "50%", "75%", "Max"].map((pct) => (
        <button
          key={pct}
          onClick={(e) => {
            e.stopPropagation()
            handlePercentageClick(pct)
          }}
          className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[12px] font-bold text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
        >
          {pct}
        </button>
      ))}
    </div>
  )
})
