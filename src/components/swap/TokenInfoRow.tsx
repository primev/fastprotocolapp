"use client"

import React from "react"
import { Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Token } from "@/types/swap"
import type { UseBalanceReturnType } from "wagmi"

interface TokenInfoRowProps {
  displayAmount: string
  tokenPrice: number | null
  isLoadingPrice: boolean
  token: Token | undefined
  balance: UseBalanceReturnType["data"]
  balanceValue: number
  formattedBalance: string
  isLoadingBalance: boolean
  isConnected: boolean
  address: string | undefined
  showError?: boolean
  side?: "sell" | "buy"
}

export default React.memo(function TokenInfoRow({
  displayAmount,
  tokenPrice,
  isLoadingPrice,
  token,
  balance,
  balanceValue,
  formattedBalance,
  isLoadingBalance,
  isConnected,
  address,
  showError,
  side,
}: TokenInfoRowProps) {
  // Remove commas from displayAmount before parsing (formatTokenAmount returns values like "3,017.65")
  const cleanDisplayAmount = displayAmount ? displayAmount.replace(/,/g, "") : ""
  const numericDisplayAmount =
    cleanDisplayAmount && !isNaN(parseFloat(cleanDisplayAmount))
      ? parseFloat(cleanDisplayAmount)
      : 0
  const usdValue = numericDisplayAmount > 0 && tokenPrice ? numericDisplayAmount * tokenPrice : null

  // Determine what to show for USD value
  const getUsdDisplay = () => {
    if (usdValue) {
      return `$${usdValue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      })}`
    }

    // For sell side: show "$0" when no amount
    // For buy side: show empty string when no amount
    if (numericDisplayAmount === 0 || !displayAmount || displayAmount === "0") {
      return side === "sell" ? "$0" : ""
    }

    // If there's an amount but price is loading, show loading indicator
    if (isLoadingPrice) {
      return "—"
    }

    // Default fallback
    return "—"
  }

  const formatBalanceDisplay = (value: number): string => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 5,
      useGrouping: false,
    })
  }

  return (
    <div className="flex justify-between items-center text-sm font-medium text-white/70 tracking-tight">
      <span className="font-medium">{getUsdDisplay()}</span>
      {isConnected && address && token && balance && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Wallet size={14} className="opacity-50" />
                <span className={cn("font-medium", showError && "text-destructive")}>
                  {isLoadingBalance ? "—" : `${formatBalanceDisplay(balanceValue)} ${token.symbol}`}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-mono bg-zinc-900 border-zinc-700">
              <p className="text-white/90">Full balance:</p>
              <p className="text-white/70">
                {balanceValue.toLocaleString("en-US", {
                  maximumFractionDigits: 18,
                  useGrouping: false,
                })}{" "}
                {token.symbol}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
})
