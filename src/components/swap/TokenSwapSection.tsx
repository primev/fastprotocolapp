"use client"

import React from "react"
import { cn } from "@/lib/utils"
import AmountInput from "./AmountInput"
import PercentageButtons from "./PercentageButtons"
import TokenInfoRow from "./TokenInfoRow"
import TokenSelectButton from "./TokenSelectButton"
import CommonTokenButtons from "./CommonTokenButtons"
import type { Token } from "@/types/swap"
import type { UseBalanceReturnType } from "wagmi"

interface TokenSwapSectionProps {
  side: "sell" | "buy"
  label: string
  isActive: boolean
  token: Token | undefined
  amount: string
  displayQuote: string | null
  quoteAmount: string | undefined
  onAmountChange: (value: string) => void
  onAmountFocus: () => void
  onAmountBlur: () => void
  onTokenSelect: (e: React.MouseEvent) => void
  balance: UseBalanceReturnType["data"]
  balanceValue: number
  formattedBalance: string
  isLoadingBalance: boolean
  tokenPrice: number | null
  isLoadingPrice: boolean
  isConnected: boolean
  address: string | undefined
  insufficientBalance: boolean
  shouldPulse: boolean
  shouldPulseLoop: boolean
  isQuoteLoading: boolean
  pulseAnimationKey: number
  inputRef?: React.RefObject<HTMLInputElement>
  outputAmount?: string
  commonTokens?: Token[]
  onCommonTokenSelect?: (token: Token) => void
}

export default React.memo(function TokenSwapSection({
  side,
  label,
  isActive,
  token,
  amount,
  displayQuote,
  quoteAmount,
  onAmountChange,
  onAmountFocus,
  onAmountBlur,
  onTokenSelect,
  balance,
  balanceValue,
  formattedBalance,
  isLoadingBalance,
  tokenPrice,
  isLoadingPrice,
  isConnected,
  address,
  insufficientBalance,
  shouldPulse,
  shouldPulseLoop,
  isQuoteLoading,
  pulseAnimationKey,
  inputRef,
  outputAmount,
  commonTokens,
  onCommonTokenSelect,
}: TokenSwapSectionProps) {
  const displayValue =
    side === "sell"
      ? isActive
        ? amount
        : displayQuote || quoteAmount || null
      : isActive
        ? amount
        : displayQuote || quoteAmount || null

  const displayAmountForInfo =
    side === "sell"
      ? isActive
        ? amount
        : outputAmount || null
      : isActive
        ? amount
        : outputAmount || null

  return (
    <div
      className={cn(
        `group/${side} rounded-[20px] p-4 flex flex-col gap-2 transition-all min-h-[140px]`,
        isActive ? "bg-[#222] shadow-2xl" : "bg-[#1B1B1B]/50"
      )}
    >
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {side === "sell" ? (
          <PercentageButtons
            balance={balance}
            token={token}
            isConnected={isConnected}
            onSelect={onAmountChange}
          />
        ) : commonTokens && commonTokens.length > 0 && onCommonTokenSelect ? (
          <CommonTokenButtons tokens={commonTokens} onSelect={onCommonTokenSelect} />
        ) : null}
      </div>

      <div className="flex justify-between items-center mt-1">
        <AmountInput
          value={displayValue}
          onChange={onAmountChange}
          onFocus={onAmountFocus}
          onBlur={onAmountBlur}
          isActive={isActive}
          isDisabled={!isConnected}
          showError={insufficientBalance && isActive}
          shouldPulse={shouldPulse}
          shouldPulseLoop={shouldPulseLoop}
          isQuoteLoading={isQuoteLoading}
          pulseAnimationKey={pulseAnimationKey}
          inputRef={inputRef}
        />
        <TokenSelectButton
          token={token}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onTokenSelect(e)
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <TokenInfoRow
          displayAmount={displayAmountForInfo}
          tokenPrice={tokenPrice}
          isLoadingPrice={isLoadingPrice}
          token={token}
          balance={balance}
          balanceValue={balanceValue}
          formattedBalance={formattedBalance}
          isLoadingBalance={isLoadingBalance}
          isConnected={isConnected}
          address={address}
          showError={side === "sell" && insufficientBalance}
        />
      </div>
    </div>
  )
})
