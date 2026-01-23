"use client"

import React, { useState, useEffect } from "react"
// UI Components & Icons
import { ChevronDown, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

// Local Components
import AmountInput from "./AmountInput"
import TokenInfoRow from "./TokenInfoRow"

// Types
import { Token } from "@/types/swap"
import { QuoteResult } from "@/hooks/use-quote-v2"
import { UseBalanceReturnType } from "wagmi"

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

export const SellCard: React.FC<SellCardProps> = ({
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
  const [hasImageError, setHasImageError] = useState(false)

  /**
   * Reset image error state if the token changes.
   */
  useEffect(() => {
    setHasImageError(false)
  }, [fromToken?.address])

  const handleAmountChange = (value: string) => {
    // When the user changes the "Sell" amount, we reset inversion and existing quotes
    setIsManualInversion(false)
    setSwappedQuote(null)
    setAmount(value)
  }

  return (
    <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
      {/* Header: Label and Balance Information */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sell</span>
        {fromToken && (
          <span className="flex items-center gap-1 text-sm font-medium text-white/70">
            <Wallet size={14} /> {formattedFromBalance}
          </span>
        )}
      </div>

      {/* Input and Token Selector Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <AmountInput
            value={sellDisplayValue}
            onChange={handleAmountChange}
            onFocus={() => setEditingSide("sell")}
            onBlur={() => {}}
            isActive={editingSide === "sell"}
            isDisabled={false}
            showError={insufficientBalance}
            isQuoteLoading={effectiveQuoteLoading}
            inputRef={sellInputRef}
          />
          <TokenInfoRow
            displayAmount={amount}
            tokenPrice={activeFromTokenPrice}
            isLoadingPrice={isLoadingFromPrice}
            token={fromToken}
            balance={fromBalance}
            balanceValue={fromBalanceValue}
            formattedBalance={formattedFromBalance}
            isLoadingBalance={isLoadingFromBalance}
            isConnected={isConnected}
            address={address}
            showError={insufficientBalance}
            side="sell"
          />
        </div>

        {/* Token Selector Trigger */}
        <button
          onClick={() => setIsFromTokenSelectorOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0",
            fromToken
              ? "bg-white/10 hover:bg-white/15 text-white"
              : "bg-primary hover:bg-primary/90 text-white"
          )}
        >
          {fromToken ? (
            <>
              <div className="h-6 w-6 flex items-center justify-center overflow-hidden rounded-full">
                {hasImageError ? (
                  <div className="h-full w-full flex items-center justify-center bg-gray-600 text-[10px] font-bold text-white uppercase">
                    {fromToken.symbol.charAt(0)}
                  </div>
                ) : (
                  <img
                    src={fromToken.logoURI}
                    alt={fromToken.symbol}
                    className="h-full w-full object-contain"
                    onError={() => setHasImageError(true)}
                  />
                )}
              </div>
              {fromToken.symbol}
            </>
          ) : (
            "Select token"
          )}
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
