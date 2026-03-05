"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
// UI Components & Icons
import { ChevronDown, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

// Local Components
import AmountInput from "./AmountInput"
import TokenInfoRow from "./TokenInfoRow"

// Types
import { Token } from "@/types/swap"
import { QuoteResult } from "@/hooks/use-swap-quote"
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
  const [hasImageError, setHasImageError] = useState(false)

  /**
   * Reset image error state if the token changes.
   */
  useEffect(() => {
    setHasImageError(false)
  }, [fromToken?.address])

  const handleAmountChange = (value: string) => {
    setEditingSide("sell")
    setAmount(value)
  }

  return (
    <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
      {/* Header: Label and Balance Information */}
      <div className="flex items-center justify-between -mb-1">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sell</span>
        {fromToken && (
          <span className="flex items-center gap-1 text-sm font-medium text-white/40">
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
          <TokenInfoRow
            displayAmount={amount}
            tokenPrice={activeFromTokenPrice}
            isLoadingPrice={isLoadingFromPrice}
            isQuoteLoading={effectiveQuoteLoading}
            side="sell"
          />
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
              <div className="h-6 w-6 min-w-[24px] min-h-[24px] flex items-center justify-center overflow-hidden rounded-full shrink-0">
                {hasImageError || !fromToken.logoURI ? (
                  <div className="h-full w-full flex items-center justify-center bg-gray-600 text-[10px] font-bold text-white uppercase">
                    {fromToken.symbol.charAt(0)}
                  </div>
                ) : (
                  <Image
                    src={fromToken.logoURI}
                    alt={fromToken.symbol}
                    width={24}
                    height={24}
                    className="h-full w-full object-contain"
                    onError={() => setHasImageError(true)}
                    loading="lazy"
                    unoptimized
                  />
                )}
              </div>
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
