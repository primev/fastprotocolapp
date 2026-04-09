"use client"

import React from "react"
// UI Components & Icons
import { ChevronDown } from "lucide-react"
import { formatUnits } from "viem"
import { cn, formatTokenAmount } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Local Components
import AmountInput from "./AmountInput"
import TokenInfoRow from "./TokenInfoRow"

// Hooks
import { useBalanceFlash } from "@/hooks/use-balance-flash"

// Types
import { Token } from "@/types/swap"
import { QuoteResult } from "@/hooks/use-swap-quote"
import { UseBalanceReturnType } from "wagmi"
import { ZERO_ADDRESS } from "@/lib/swap-constants"
import { TokenAvatar } from "@/components/swap/TokenAvatar"

interface SellCardProps {
  // Token & Balance Data
  fromToken: Token | null
  amount: string
  sellDisplayValue: string
  formattedFromBalance: string
  fromBalance: UseBalanceReturnType["data"]
  fromBalanceValue: number

  // Market & Loading State
  activeFromTokenPrice: number
  isLoadingFromPrice: boolean
  isLoadingFromBalance: boolean
  effectiveQuoteLoading: boolean
  insufficientBalance: boolean

  // UI & Interaction
  editingSide: "sell" | "buy"
  isConnected: boolean
  address?: string
  sellInputRef: React.RefObject<HTMLInputElement>

  // Callbacks for Global State Sync
  setAmount: (amount: string) => void
  setEditingSide: (side: "sell" | "buy") => void
  setIsFromTokenSelectorOpen: (open: boolean) => void
  setIsManualInversion: (isManual: boolean) => void
  setSwappedQuote: (quote: QuoteResult | null) => void
}

const SellCardComponent: React.FC<SellCardProps> = ({
  fromToken,
  amount,
  sellDisplayValue,
  formattedFromBalance,
  fromBalance,
  fromBalanceValue,
  activeFromTokenPrice,
  isLoadingFromPrice,
  isLoadingFromBalance,
  effectiveQuoteLoading,
  insufficientBalance,
  editingSide,
  isConnected,
  address,
  sellInputRef,
  setAmount,
  setEditingSide,
  setIsFromTokenSelectorOpen,
  setIsManualInversion,
  setSwappedQuote,
}) => {
  const balanceFlash = useBalanceFlash(fromBalanceValue, fromToken?.address, isConnected)

  const applyBalanceFraction = (percent: 25 | 50 | 75 | 100) => {
    if (!fromToken || !fromBalance || fromBalance.value === 0n) return
    setEditingSide("sell")
    setIsManualInversion(false)
    setSwappedQuote(null)

    const isNativeEth = fromToken.address === ZERO_ADDRESS
    let value: bigint
    if (percent === 100) {
      if (isNativeEth) {
        const reserve = 10n ** 15n // 0.001 ETH in wei (~$2 gas buffer)
        value = fromBalance.value > reserve ? fromBalance.value - reserve : 0n
      } else {
        value = fromBalance.value
      }
    } else {
      value = (fromBalance.value * BigInt(percent)) / 100n
    }
    if (value === 0n) return
    const raw = formatUnits(value, fromToken.decimals)
    // MAX (100%) must use the raw string so parseFloat(amount) exactly
    // matches fromBalanceValue downstream — otherwise stablecoin formatting
    // (2 dp, rounded) can round UP past the true balance and trigger a
    // false "insufficient balance" error.
    if (percent === 100) {
      setAmount(raw)
      return
    }
    // Fractional clicks: apply the app's display formatting rules so we
    // don't dump 18-decimal precision into the input. Strip locale commas —
    // amount state must remain parseable.
    const formatted = formatTokenAmount(
      raw,
      fromToken.symbol,
      undefined,
      fromToken.address
    ).replace(/,/g, "")
    setAmount(formatted || raw)
  }

  const handleMaxBalance = () => applyBalanceFraction(100)

  const canUseBalance = isConnected && !!fromBalance && fromBalance.value > 0n

  const handleAmountChange = (value: string) => {
    setEditingSide("sell")
    setAmount(value)
  }

  return (
    <div className="group rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
      {/* Header: Label and Balance Information */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sell</span>
          {fromToken && (
            <div className="flex items-center gap-1 text-[11px]">
              <TooltipProvider delayDuration={150}>
                {([25, 50, 75, 100] as const).map((pct) => {
                  const btn = (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyBalanceFraction(pct)}
                      disabled={!canUseBalance}
                      className="px-1.5 py-0.5 rounded-md bg-transparent border border-transparent text-gray-500 group-hover:bg-white/5 group-hover:border-white/10 group-hover:text-gray-300 hover:!bg-white/10 hover:!text-white hover:!border-white/20 transition-colors disabled:opacity-50 disabled:hover:!bg-transparent disabled:hover:!text-gray-500 disabled:hover:!border-transparent disabled:cursor-default cursor-pointer leading-none font-medium"
                    >
                      {pct === 100 ? "MAX" : `${pct}%`}
                    </button>
                  )
                  if (pct === 100 && fromToken?.address === ZERO_ADDRESS) {
                    return (
                      <Tooltip key={pct}>
                        <TooltipTrigger asChild>{btn}</TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-xs leading-snug">
                          A small amount of the network token balance is reserved to cover the network cost of this transaction.
                        </TooltipContent>
                      </Tooltip>
                    )
                  }
                  return btn
                })}
              </TooltipProvider>
            </div>
          )}
        </div>
        {fromToken && (
          <button
            type="button"
            onClick={handleMaxBalance}
            disabled={!isConnected || !fromBalance || fromBalance.value === 0n}
            className={cn(
              "text-xs transition-colors duration-700 hover:text-white disabled:hover:text-gray-500 disabled:cursor-default cursor-pointer",
              balanceFlash === "green" ? "text-green-400" : "text-gray-500"
            )}
          >
            Balance: {formattedFromBalance}
          </button>
        )}
      </div>

      {/* Input and Token Selector Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <AmountInput
            value={sellDisplayValue}
            onChange={handleAmountChange}
            onFocus={() => {
              if (editingSide !== "sell") {
                setAmount(sellDisplayValue?.replace(/,/g, "") || "")
              }
              setEditingSide("sell")
            }}
            onBlur={() => {}}
            isActive={editingSide === "sell"}
            isDisabled={false}
            showError={insufficientBalance}
            isQuoteLoading={effectiveQuoteLoading}
            inputRef={sellInputRef}
          />
          {fromToken && !!amount && amount !== "0" && (
            <TokenInfoRow
              displayAmount={amount}
              tokenPrice={activeFromTokenPrice}
              isLoadingPrice={isLoadingFromPrice}
              isQuoteLoading={effectiveQuoteLoading}
              side="sell"
            />
          )}
        </div>

        {/* Token Selector Trigger - min-w prevents CLS when token loads */}
        <button
          onClick={() => setIsFromTokenSelectorOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0 min-w-[120px] justify-between",
            fromToken
              ? "bg-white/10 hover:bg-white/15 text-white"
              : "bg-primary hover:bg-primary/90 text-white"
          )}
        >
          {fromToken ? (
            <>
              <TokenAvatar token={fromToken} size={24} />
              {fromToken.symbol}
            </>
          ) : (
            "Select token"
          )}
          <ChevronDown className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  )
}

export const SellCard = React.memo(SellCardComponent)
