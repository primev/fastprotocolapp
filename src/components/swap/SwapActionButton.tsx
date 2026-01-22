"use client"

import React from "react"
import { cn } from "@/lib/utils"
import type { Token } from "@/types/swap"

interface SwapActionButtonProps {
  hasStarted: boolean
  insufficientBalance: boolean
  isConnected: boolean
  fromToken: Token | undefined
  toToken: Token | undefined
  amount: string
  quote: unknown
  hasVeryHighPriceImpact: boolean
  isSigning: boolean
  isSubmitting: boolean
  editingSide: "sell" | "buy"
  onGetStarted: () => void
  onSwap: () => void
}

export default React.memo(function SwapActionButton({
  hasStarted,
  insufficientBalance,
  isConnected,
  fromToken,
  toToken,
  amount,
  quote,
  hasVeryHighPriceImpact,
  isSigning,
  isSubmitting,
  editingSide,
  onGetStarted,
  onSwap,
}: SwapActionButtonProps) {
  if (!hasStarted) {
    // When not started, show "Get Started" if there's any token selected
    // Don't let switching affect this - if either token exists, show "Get Started"
    if (!fromToken && !toToken) {
      return (
        <button
          disabled={true}
          onClick={onGetStarted}
          className={cn(
            "mt-1 w-full py-4 rounded-[20px] font-bold text-lg transition-all border border-white/10",
            "bg-zinc-900/50 text-zinc-600 cursor-not-allowed"
          )}
        >
          Select Tokens
        </button>
      )
    }

    return (
      <button
        disabled={false}
        onClick={onGetStarted}
        className={cn(
          "mt-1 w-full py-3 rounded-[20px] font-bold text-lg transition-all border border-white/10",
          "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
        )}
      >
        Get Started
      </button>
    )
  }

  const isDisabled =
    insufficientBalance ||
    !isConnected ||
    !fromToken ||
    !toToken ||
    !amount ||
    parseFloat(amount) <= 0 ||
    !quote ||
    hasVeryHighPriceImpact ||
    isSigning ||
    isSubmitting

  // Priority order for button text:
  // 1. Loading states (signing/submitting)
  // 2. Connection state
  // 3. Missing sell token (fromToken) - most important for user
  // 4. Missing buy token (toToken)
  // 5. Insufficient balance (always reference sell token)
  // 6. Amount validation
  // 7. Quote loading
  // 8. Price impact
  // 9. Ready to swap
  const buttonText = isSigning
    ? "Signing..."
    : isSubmitting
      ? "Submitting..."
      : !isConnected
        ? "Connect Wallet"
        : !fromToken
          ? "Select Tokens"
          : !toToken
            ? "Select Tokens"
            : insufficientBalance
              ? `Not enough ${fromToken.symbol}`
              : !amount || parseFloat(amount) <= 0
                ? "Enter Amount"
                : !quote
                  ? "Loading Quote..."
                  : hasVeryHighPriceImpact
                    ? "Price Impact Too High"
                    : "Swap"

  return (
    <button
      disabled={isDisabled}
      onClick={onSwap}
      className={cn(
        "mt-2 mx-2 mb-2 w-[calc(100%-1rem)] py-4 rounded-[16px] font-semibold text-base transition-all duration-200",
        isDisabled
          ? "bg-[#1B1B1B] text-white/40 cursor-not-allowed border border-white/5"
          : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-[1.01]"
      )}
    >
      {buttonText}
    </button>
  )
})
