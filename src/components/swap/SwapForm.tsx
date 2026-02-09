"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useAccount } from "wagmi"
import { formatBalance } from "@/lib/utils"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { getTokenLists } from "@/lib/swap-logic/token-list"
import { useSwapForm } from "@/hooks/use-swap-form"

import { SwapInterface } from "./SwapInterface"

const SwapConfirmationModal = dynamic(() => import("@/components/modals/SwapConfirmationModal"), {
  ssr: false,
})

const TokenSelectorModal = dynamic(
  () => import("./TokenSelectorModal").then((m) => m.TokenSelectorModal),
  { ssr: false }
)

export function SwapForm() {
  const { address, isConnected } = useAccount()
  const allTokens = useMemo(() => getTokenLists(null).allTokens, [])
  const form = useSwapForm(allTokens)
  const { isLoading: isNonceLoading } = usePermit2Nonce()

  const isPermitPath =
    form.fromToken &&
    form.toToken &&
    !(form.fromToken.address === ZERO_ADDRESS && form.toToken.address !== WETH_ADDRESS)

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFromSelectorOpen, setIsFromSelectorOpen] = useState(false)
  const [isToSelectorOpen, setIsToSelectorOpen] = useState(false)

  // Input Refs
  const sellInputRef = useRef<HTMLInputElement>(null)
  const buyInputRef = useRef<HTMLInputElement>(null)

  // Close all modals when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setIsConfirmationOpen(false)
      setIsSettingsOpen(false)
      setIsFromSelectorOpen(false)
      setIsToSelectorOpen(false)
    }
  }, [isConnected])

  const handleSwapClick = () => {
    if (!isConnected || !form.fromToken || !form.toToken) return
    setIsConfirmationOpen(true)
  }

  return (
    <div className="relative flex flex-col items-center justify-start w-full min-h-[320px]">
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
        isMounted={form.isMounted}
        // From Token Props
        fromToken={form.fromToken!}
        formattedFromBalance={formatBalance(
          form.fromBalanceValue,
          form.fromToken?.symbol,
          form.fromToken?.address
        )}
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
        formattedToBalance={formatBalance(
          form.toBalanceValue,
          form.toToken?.symbol,
          form.toToken?.address
        )}
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
        isNonceLoading={isPermitPath ? isNonceLoading : false}
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
        exchangeRateValue={form.exchangeRateValue}
        exchangeRateFromSymbol={form.exchangeRateFromSymbol}
        exchangeRateToSymbol={form.exchangeRateToSymbol}
        exchangeRateToStable={form.exchangeRateToStable}
        timeLeft={form.timeLeft}
        isWrapUnwrap={form.isWrapUnwrap}
        isWrap={form.isWrap || false}
        isUnwrap={form.isUnwrap || false}
        hasNoLiquidity={form.hasNoLiquidity}
      />

      {/* From Token Selector Modal */}
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

      {/* To Token Selector Modal */}
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
          key={`${form.fromToken.address}-${form.toToken.address}`}
          open={isConfirmationOpen}
          onOpenChange={setIsConfirmationOpen}
          tokenIn={form.fromToken}
          tokenOut={form.toToken}
          amountIn={form.amount}
          amountOut={
            form.isWrapUnwrap ? form.amount : form.displayQuote?.amountOutFormatted || form.amount
          }
          minAmountOut={
            form.isWrapUnwrap
              ? form.amount
              : form.displayQuote?.isMaxIn
                ? form.displayQuote?.amountOutFormatted || form.amount
                : form.displayQuote?.slippageLimitFormatted || form.amount
          }
          slippageLimitFormatted={
            form.isWrapUnwrap
              ? form.amount
              : form.displayQuote?.slippageLimitFormatted || form.amount
          }
          isMaxIn={form.isWrapUnwrap ? false : (form.displayQuote?.isMaxIn ?? false)}
          exchangeRate={form.isWrapUnwrap ? 1 : form.displayQuote?.exchangeRate || 1}
          priceImpact={form.isWrapUnwrap ? 0 : form.displayQuote?.priceImpact || 0}
          slippage={form.slippage}
          deadline={
            typeof form.deadline === "number" && !Number.isNaN(form.deadline) ? form.deadline : 30
          }
          gasEstimate={form.gasEstimate}
          ethPrice={form.ethPrice ?? undefined}
          fromTokenPrice={form.fromPrice ?? undefined}
          toTokenPrice={form.toPrice ?? undefined}
          timeLeft={form.timeLeft}
          refreshBalances={form.refreshBalances}
          onCloseAfterSuccess={form.resetFormAfterSuccess}
          isAutoSlippage={form.isAutoSlippage}
          setClearSwapState={form.setClearSwapState}
          needsPermit2Approval={form.needsPermit2Approval}
          isApproving={form.isApproving}
          isApprovalRejected={form.isApprovalRejected}
          approvalTxHash={form.approvalTxHash}
          onApprove={form.approvePermit2}
          approveTokenSymbol={form.approveTokenSymbol}
        />
      )}
    </div>
  )
}
