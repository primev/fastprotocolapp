"use client"

import React from "react"
// UI Components & Icons
import { ChevronDown } from "lucide-react"
import { formatUnits } from "viem"
import { cn } from "@/lib/utils"

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

  const handleMaxBalance = () => {
    if (!fromToken || !fromBalance || fromBalance.value === 0n) return
    setEditingSide("sell")
    setIsManualInversion(false)
    setSwappedQuote(null)

    const isNativeEth = fromToken.address === ZERO_ADDRESS
    if (isNativeEth) {
      // Reserve 0.01 ETH for gas
      const reserve = 10n ** 16n // 0.01 ETH in wei
      const max = fromBalance.value > reserve ? fromBalance.value - reserve : 0n
      if (max === 0n) return
      setAmount(formatUnits(max, fromToken.decimals))
    } else {
      setAmount(formatUnits(fromBalance.value, fromToken.decimals))
    }
  }

  const handleAmountChange = (value: string) => {
    setEditingSide("sell")
    setAmount(value)
  }

  return (
    <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
      {/* Header: Label and Balance Information */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sell</span>
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
