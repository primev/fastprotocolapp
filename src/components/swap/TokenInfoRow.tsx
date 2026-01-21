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
}: TokenInfoRowProps) {
  const usdValue =
    displayAmount && parseFloat(displayAmount) > 0 && tokenPrice
      ? parseFloat(displayAmount) * tokenPrice
      : null

  return (
    <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
      <span>
        {usdValue
          ? `$${usdValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
              useGrouping: true,
            })}`
          : displayAmount && parseFloat(displayAmount) > 0 && isLoadingPrice
            ? "—"
            : "—"}
      </span>
      {isConnected && address && token && balance && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Wallet size={12} className="opacity-40" />
                <span className={cn(showError && "text-destructive")}>
                  {isLoadingBalance ? "—" : `${formattedBalance} ${token.symbol}`}
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
