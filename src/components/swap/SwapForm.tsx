"use client"

import React, { useState, useRef, useEffect } from "react"
import { useAccount } from "wagmi"
import { formatBalance } from "@/lib/utils"
import { getTokenLists } from "@/lib/swap-logic/token-list"
import { useSwapForm } from "@/hooks/use-swap-form"

import { SwapInterface } from "./SwapInterface"
import SwapConfirmationModal from "@/components/modals/SwapConfirmationModal"
import { TokenSelectorModal } from "./TokenSelectorModal"
import { AnimatedBackgroundOrbs } from "./OrbAnimatedBackground"
import { Hero } from "./HeroSection"

export function SwapForm() {
  const { address, isConnected } = useAccount()
  const { allTokens } = getTokenLists(null)
  const form = useSwapForm(allTokens)

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFromSelectorOpen, setIsFromSelectorOpen] = useState(false)
  const [isToSelectorOpen, setIsToSelectorOpen] = useState(false)

  // Input Refs
  const sellInputRef = useRef<HTMLInputElement>(null)
  const buyInputRef = useRef<HTMLInputElement>(null)

  const handleSwapClick = () => {
    if (!isConnected || !form.fromToken || !form.toToken) return
    setIsConfirmationOpen(true)
  }

  return (
    <div className="relative flex flex-col items-center justify-start px-4 pt-2 sm:pt-6 pb-4">
      <AnimatedBackgroundOrbs />
      <Hero />

      <SwapInterface
        // Settings Props
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        isAutoSlippage={form.isAutoSlippage}
        handleAutoSlippageChange={form.updateAutoSlippage}
        calculatedAutoSlippage={form.calculatedAutoSlippage || 0}
        slippage={form.slippage}
        handleSlippageChange={form.updateSlippage}
        internalDeadline={form.deadline}
        setInternalDeadline={form.updateDeadline}
        // From Token Props
        fromToken={form.fromToken!}
        formattedFromBalance={formatBalance(form.fromBalanceValue, form.fromToken?.symbol)}
        sellDisplayValue={
          form.editingSide === "sell" ? form.amount : form.displayQuote?.amountInFormatted || ""
        }
        fromBalance={form.fromBalance}
        fromBalanceValue={form.fromBalanceValue}
        isLoadingFromBalance={form.isLoadingFromBalance}
        isLoadingFromPrice={form.isLoadingFromPrice}
        activeFromTokenPrice={form.fromPrice || 0}
        setIsFromTokenSelectorOpen={setIsFromSelectorOpen}
        sellInputRef={sellInputRef}
        // To Token Props
        toToken={form.toToken!}
        formattedToBalance={formatBalance(form.toBalanceValue, form.toToken?.symbol)}
        buyDisplayValue={
          form.isWrapUnwrap
            ? form.amount
            : form.editingSide === "buy"
              ? form.amount
              : form.displayQuote?.amountOutFormatted ||
                (form.hasNoLiquidity ? "No liquidity" : "0")
        }
        toBalance={form.toBalance}
        toBalanceValue={form.toBalanceValue}
        isLoadingToBalance={form.isLoadingToBalance}
        isLoadingToPrice={form.isLoadingToPrice}
        activeToTokenPrice={form.toPrice || 0}
        setIsToTokenSelectorOpen={setIsToSelectorOpen}
        buyInputRef={buyInputRef}
        // Action Props
        amount={form.amount}
        outputAmount={form.isWrapUnwrap ? form.amount : form.activeQuote?.amountOutFormatted || "0"}
        setAmount={form.setAmount}
        editingSide={form.editingSide}
        setEditingSide={form.setEditingSide}
        handleSwitch={form.handleSwitch}
        handleSwapClick={handleSwapClick}
        isConnected={isConnected}
        address={address}
        insufficientBalance={parseFloat(form.amount || "0") > form.fromBalanceValue}
        // Quote Props
        activeQuote={form.activeQuote}
        displayQuote={form.displayQuote}
        effectiveQuoteLoading={form.isQuoteLoading}
        setSwappedQuote={form.setSwappedQuote}
        setIsManualInversion={form.setIsManualInversion}
        isManualInversion={form.isManualInversion}
        exchangeRateContent={form.exchangeRateContent}
        timeLeft={form.timeLeft}
        isWrapUnwrap={form.isWrapUnwrap}
        isWrap={form.isWrap || false}
        isUnwrap={form.isUnwrap || false}
        hasNoLiquidity={form.hasNoLiquidity}
      />

      {/* Modal Components with Mandatory Props */}
      <TokenSelectorModal
        open={isFromSelectorOpen}
        onOpenChange={setIsFromSelectorOpen}
        selectedToken={form.fromToken?.symbol}
        excludeToken={form.toToken?.symbol}
        customTokens={{}}
        onAddCustomToken={() => {}}
        onSelectToken={(sym) => {
          const token = allTokens.find((t) => t.symbol === sym)
          if (token) {
            form.setFromToken(token)
          }
        }}
      />

      <TokenSelectorModal
        open={isToSelectorOpen}
        onOpenChange={setIsToSelectorOpen}
        selectedToken={form.toToken?.symbol}
        excludeToken={form.fromToken?.symbol}
        customTokens={{}}
        onAddCustomToken={() => {}}
        onSelectToken={(sym) => {
          const token = allTokens.find((t) => t.symbol === sym)
          if (token) {
            form.setToToken(token)
          }
        }}
      />

      {form.fromToken && form.toToken && (
        <SwapConfirmationModal
          open={isConfirmationOpen}
          onOpenChange={setIsConfirmationOpen}
          tokenIn={form.fromToken}
          tokenOut={form.toToken}
          amountIn={form.amount}
          amountOut={form.displayQuote?.amountOutFormatted || form.amount}
          minAmountOut={form.displayQuote?.amountOutFormatted || form.amount}
          exchangeRate={form.displayQuote?.exchangeRate || 1}
          priceImpact={form.displayQuote?.priceImpact || 0}
          slippage={form.slippage}
          gasEstimate={form.gasEstimate}
          timeLeft={form.timeLeft}
          isWrap={form.isWrap}
          isUnwrap={form.isUnwrap}
        />
      )}
    </div>
  )
}
