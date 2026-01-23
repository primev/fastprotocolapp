"use client"

import React, { useState } from "react"
// UI Components & Icons
import { ChevronDown, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

// Local Components
import AmountInput from "./AmountInput"
import TokenInfoRow from "./TokenInfoRow"

// Types
import { Token } from "@/types/swap"
import { UseBalanceReturnType } from "wagmi"

/**
 * Optimized Prop Interface.
 * I have removed props that can be derived or handled locally,
 * focusing only on the "Single Source of Truth" data.
 */
interface BuyCardProps {
  // Token & Value Data (Required for Parent Swap Logic)
  toToken: Token | null
  buyDisplayValue: string
  outputAmount: string
  formattedToBalance: string

  // Blockchain/Balance State (Usually from Wagmi hooks in parent)
  toBalance: UseBalanceReturnType["data"]
  toBalanceValue: number
  isLoadingToBalance: boolean

  // Market Data
  activeToTokenPrice: number
  isLoadingToPrice: boolean
  effectiveQuoteLoading: boolean

  // Identity & Connection
  isConnected: boolean
  address?: string

  // Global UI State Sync
  editingSide: "sell" | "buy"
  setEditingSide: (side: "sell" | "buy") => void
  setAmount: (amount: string) => void
  setIsToTokenSelectorOpen: (open: boolean) => void

  // Input Control
  buyInputRef: React.RefObject<HTMLInputElement>
}

export const BuyCard: React.FC<BuyCardProps> = ({
  toToken,
  buyDisplayValue,
  outputAmount,
  formattedToBalance,
  toBalance,
  toBalanceValue,
  isLoadingToBalance,
  activeToTokenPrice,
  isLoadingToPrice,
  effectiveQuoteLoading,
  isConnected,
  address,
  editingSide,
  setEditingSide,
  setAmount,
  setIsToTokenSelectorOpen,
  buyInputRef,
}) => {
  /**
   * 1. LOCAL UI STATE
   * Instead of passing image error handling logic from the parent,
   * we handle it locally. This keeps the parent's logic clean and
   * prevents unnecessary re-renders of the entire swap interface.
   */
  const [hasImageError, setHasImageError] = useState(false)

  /**
   * 2. EVENT HANDLERS
   * Internalized logic for triggering "buy" side focus when the user
   * interacts with the amount input.
   */
  const handleAmountChange = (value: string) => {
    setEditingSide("buy")
    setAmount(value)
  }

  return (
    <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Buy</span>
        {toToken && (
          <span className="flex items-center gap-1 text-sm font-medium text-white/70">
            <Wallet size={14} /> {formattedToBalance}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <AmountInput
            value={toToken ? buyDisplayValue : ""}
            onChange={handleAmountChange}
            onFocus={() => setEditingSide("buy")}
            onBlur={() => {}}
            isActive={editingSide === "buy"}
            isDisabled={!toToken}
            showError={false}
            isQuoteLoading={effectiveQuoteLoading}
            inputRef={buyInputRef}
          />

          <TokenInfoRow
            displayAmount={outputAmount || "0"}
            tokenPrice={activeToTokenPrice}
            isLoadingPrice={isLoadingToPrice}
            side="buy"
          />
        </div>

        {/* Token Selector Button */}
        <button
          onClick={() => setIsToTokenSelectorOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0",
            toToken
              ? "bg-white/10 hover:bg-white/15 text-white"
              : "bg-primary hover:bg-primary/90 text-white"
          )}
        >
          {toToken ? (
            <>
              <div className="h-6 w-6 flex items-center justify-center overflow-hidden rounded-full">
                {hasImageError ? (
                  <div className="h-full w-full flex items-center justify-center bg-gray-600 text-[10px] font-bold text-white uppercase">
                    {toToken.symbol.charAt(0)}
                  </div>
                ) : (
                  <img
                    src={toToken.logoURI}
                    alt={toToken.symbol}
                    className="h-full w-full object-contain"
                    onError={() => setHasImageError(true)}
                  />
                )}
              </div>
              {toToken.symbol}
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
