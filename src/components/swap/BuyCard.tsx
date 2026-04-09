"use client"

import React from "react"
// UI Components & Icons
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Local Components
import AmountInput from "./AmountInput"
import TokenInfoRow from "./TokenInfoRow"

// Hooks
import { useBalanceFlash } from "@/hooks/use-balance-flash"

// Types
import { Token } from "@/types/swap"
import { UseBalanceReturnType } from "wagmi"
import { TokenAvatar } from "@/components/swap/TokenAvatar"

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

const BuyCardComponent: React.FC<BuyCardProps> = ({
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
  const balanceFlash = useBalanceFlash(toBalanceValue, toToken?.address, isConnected)

  /**
   * 2. EVENT HANDLERS
   * Internalized logic for triggering "buy" side focus when the user
   * interacts with the amount input.
   */
  const handleAmountChange = (value: string) => {
    setEditingSide("buy")
    setAmount(value)
  }

  const handleBalanceClick = () => {
    if (!toToken || toBalanceValue <= 0 || !isConnected) return
    setEditingSide("buy")
    setAmount(toBalanceValue.toString())
  }

  return (
    <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Buy</span>
        {toToken && (
          <button
            type="button"
            onClick={handleBalanceClick}
            disabled={!isConnected || toBalanceValue <= 0}
            className={cn(
              "text-xs transition-colors duration-700 hover:text-white disabled:hover:text-gray-500 disabled:cursor-default cursor-pointer",
              balanceFlash === "green" ? "text-green-400" : "text-gray-500"
            )}
          >
            Balance: {formattedToBalance}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <AmountInput
            value={toToken ? buyDisplayValue : ""}
            onChange={handleAmountChange}
            onFocus={() => {
              if (editingSide !== "buy") {
                const cleanValue = buyDisplayValue?.replace(/,/g, "") || ""
                if (cleanValue && !isNaN(parseFloat(cleanValue))) {
                  setAmount(cleanValue)
                }
              }
              setEditingSide("buy")
            }}
            onBlur={() => {}}
            isActive={editingSide === "buy"}
            isDisabled={!toToken}
            showError={false}
            isQuoteLoading={effectiveQuoteLoading}
            inputRef={buyInputRef}
          />

          {toToken && !!outputAmount && outputAmount !== "0" && (
            <TokenInfoRow
              displayAmount={outputAmount}
              tokenPrice={activeToTokenPrice}
              isLoadingPrice={isLoadingToPrice}
              isQuoteLoading={effectiveQuoteLoading}
              side="buy"
            />
          )}
        </div>

        {/* Token Selector Button - min-w prevents CLS when token loads */}
        <button
          onClick={() => setIsToTokenSelectorOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0 min-w-[120px] justify-between",
            toToken
              ? "bg-white/10 hover:bg-white/15 text-white"
              : "bg-primary hover:bg-primary/90 text-white"
          )}
        >
          {toToken ? (
            <>
              <TokenAvatar token={toToken} size={24} />
              {toToken.symbol}
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

export const BuyCard = React.memo(BuyCardComponent)
