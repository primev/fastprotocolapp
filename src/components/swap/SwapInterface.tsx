"use client"

import React from "react"

// Local Sub-Components
// Each component now manages its own internal UI logic (like image errors or local formatting)
import { TransactionSettings } from "./TransactionSettings"
import { SellCard } from "./SellCard"
import { SwitchButton } from "./SwitchButton"
import { BuyCard } from "./BuyCard"
import { ExchangeRate } from "./ExchangeRate"
import { ActionButton } from "./ActionButton"
import { RewardsBadge } from "./RewardsBadge"

// Types
import { Token } from "@/types/swap"
import { QuoteResult } from "@/hooks/use-quote-v2"
import { UseBalanceReturnType } from "wagmi"

/**
 * The SwapInterface serves as the layout controller.
 * It passes state down to specialized components which handle their own
 * rendering and local UI interactions.
 */
interface SwapInterfaceProps {
  // Global Transaction Settings State
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void
  isAutoSlippage: boolean
  handleAutoSlippageChange: (isAuto: boolean) => void
  calculatedAutoSlippage: number
  slippage: string
  handleSlippageChange: (slippage: string) => void
  internalDeadline: number
  setInternalDeadline: (deadline: number) => void

  // Input Asset (Sell) State
  fromToken: Token | null
  formattedFromBalance: string
  sellDisplayValue: string
  fromBalance: UseBalanceReturnType["data"]
  fromBalanceValue: number
  isLoadingFromBalance: boolean
  isLoadingFromPrice: boolean
  activeFromTokenPrice: number
  setIsFromTokenSelectorOpen: (open: boolean) => void
  sellInputRef: React.RefObject<HTMLInputElement>

  // Output Asset (Buy) State
  toToken: Token | null
  formattedToBalance: string
  buyDisplayValue: string
  toBalance: UseBalanceReturnType["data"]
  toBalanceValue: number
  isLoadingToBalance: boolean
  isLoadingToPrice: boolean
  activeToTokenPrice: number
  setIsToTokenSelectorOpen: (open: boolean) => void
  buyInputRef: React.RefObject<HTMLInputElement>

  // Global Interaction & Validation
  amount: string
  outputAmount: string
  setAmount: (amount: string) => void
  editingSide: "sell" | "buy"
  setEditingSide: (side: "sell" | "buy") => void
  handleSwitch: () => void
  handleSwapClick: () => void
  isConnected: boolean
  address?: string
  insufficientBalance: boolean

  // Quote & Execution Details
  activeQuote: QuoteResult | null
  displayQuote: QuoteResult | null
  effectiveQuoteLoading: boolean
  setSwappedQuote: (quote: QuoteResult | null) => void
  setIsManualInversion: (isManual: boolean) => void
  isManualInversion: boolean
  exchangeRateContent: React.ReactNode
  timeLeft: number
  isWrapUnwrap: boolean
  isWrap: boolean
  isUnwrap: boolean
  hasNoLiquidity: boolean
}

export const SwapInterface: React.FC<SwapInterfaceProps> = (props) => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    isAutoSlippage,
    handleAutoSlippageChange,
    calculatedAutoSlippage,
    slippage,
    handleSlippageChange,
    internalDeadline,
    setInternalDeadline,
    fromToken,
    formattedFromBalance,
    sellDisplayValue,
    fromBalance,
    fromBalanceValue,
    isLoadingFromBalance,
    isLoadingFromPrice,
    activeFromTokenPrice,
    setIsFromTokenSelectorOpen,
    sellInputRef,
    toToken,
    formattedToBalance,
    buyDisplayValue,
    toBalance,
    toBalanceValue,
    isLoadingToBalance,
    isLoadingToPrice,
    activeToTokenPrice,
    setIsToTokenSelectorOpen,
    buyInputRef,
    amount,
    outputAmount,
    setAmount,
    editingSide,
    setEditingSide,
    handleSwitch,
    handleSwapClick,
    isConnected,
    address,
    insufficientBalance,
    activeQuote,
    displayQuote,
    effectiveQuoteLoading,
    setSwappedQuote,
    setIsManualInversion,
    isManualInversion,
    exchangeRateContent,
    timeLeft,
    isWrapUnwrap,
    isWrap,
    isUnwrap,
    hasNoLiquidity,
  } = props

  return (
    <div className="relative z-10 w-full max-w-[500px] px-2 sm:px-0 mx-auto">
      {/* 1. HEADER & SETTINGS 
          Handles the "Swap" title and the configuration popover.
      */}
      <TransactionSettings
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        isAutoSlippage={isAutoSlippage}
        handleAutoSlippageChange={handleAutoSlippageChange}
        calculatedAutoSlippage={calculatedAutoSlippage}
        slippage={slippage}
        handleSlippageChange={handleSlippageChange}
        internalDeadline={internalDeadline}
        setInternalDeadline={setInternalDeadline}
      />

      {/* 2. CORE SWAP CARDS
          SellCard and BuyCard with a SwitchButton overlay.
      */}
      <div className="relative flex flex-col">
        <SellCard
          fromToken={fromToken}
          amount={amount}
          sellDisplayValue={sellDisplayValue}
          formattedFromBalance={formattedFromBalance}
          fromBalance={fromBalance}
          fromBalanceValue={fromBalanceValue}
          activeFromTokenPrice={activeFromTokenPrice}
          editingSide={editingSide}
          setEditingSide={setEditingSide}
          isLoadingFromPrice={isLoadingFromPrice}
          isLoadingFromBalance={isLoadingFromBalance}
          insufficientBalance={insufficientBalance}
          effectiveQuoteLoading={effectiveQuoteLoading}
          sellInputRef={sellInputRef}
          isConnected={isConnected}
          address={address}
          setIsFromTokenSelectorOpen={setIsFromTokenSelectorOpen}
          setIsManualInversion={setIsManualInversion}
          setSwappedQuote={setSwappedQuote}
          setAmount={setAmount}
        />

        <div className="relative h-4 flex items-center justify-center shrink-0 z-20">
          <SwitchButton handleSwitch={handleSwitch} />
        </div>

        <BuyCard
          toToken={toToken}
          buyDisplayValue={buyDisplayValue}
          outputAmount={outputAmount}
          formattedToBalance={formattedToBalance}
          toBalance={toBalance}
          toBalanceValue={toBalanceValue}
          isLoadingToBalance={isLoadingToBalance}
          activeToTokenPrice={activeToTokenPrice}
          isLoadingToPrice={isLoadingToPrice}
          effectiveQuoteLoading={effectiveQuoteLoading}
          isConnected={isConnected}
          address={address}
          editingSide={editingSide}
          setEditingSide={setEditingSide}
          setAmount={setAmount}
          setIsToTokenSelectorOpen={setIsToTokenSelectorOpen}
          buyInputRef={buyInputRef}
        />
      </div>

      {/* 3. INFORMATION & EXECUTION
          Only show price impact and rate when both tokens are present.
          The ActionButton handles all connection and validation states.
      */}
      {fromToken && toToken && (
        <ExchangeRate
          exchangeRateContent={exchangeRateContent}
          activeQuote={displayQuote}
          isWrapUnwrap={isWrapUnwrap}
          isManualInversion={isManualInversion}
          timeLeft={timeLeft}
        />
      )}

      <ActionButton
        isConnected={isConnected}
        toToken={toToken}
        amount={amount}
        insufficientBalance={insufficientBalance}
        isWrap={isWrap}
        isUnwrap={isUnwrap}
        handleSwapClick={handleSwapClick}
      />

      {/* 4. REWARDS 
          Persistent badge for user engagement.
      */}
      <RewardsBadge />
    </div>
  )
}
