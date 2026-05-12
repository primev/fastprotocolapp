"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import { useAccount } from "wagmi"
import { useSwapToastStore } from "@/stores/swapToastStore"
import { formatBalance } from "@/lib/utils"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { getTokenLists } from "@/lib/swap-logic/token-list"
import { useSwapForm } from "@/hooks/use-swap-form"
import { useBroadcastGasPrice } from "@/hooks/use-broadcast-gas-price"
import { useEstimatedMiles } from "@/hooks/use-estimated-miles"
import { FEATURE_FLAGS } from "@/lib/feature-flags"

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

  const { rawPrice: baseFeePerGas } = useBroadcastGasPrice()

  const isEthOutput =
    form.toToken?.address?.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
    form.toToken?.address?.toLowerCase() === WETH_ADDRESS.toLowerCase()

  // Only use the quote's output for miles if the user has entered an amount.
  // After resetFormAfterSuccess, amount is "" but displayQuote may linger.
  const milesAmountOut = form.isWrapUnwrap
    ? form.amount
    : form.amount && form.displayedAmountOutFormatted
      ? form.displayedAmountOutFormatted
      : form.amount

  const {
    estimatedMiles: rawEstimatedMiles,
    milesToSlippage,
    maxAchievableMiles,
  } = useEstimatedMiles({
    amountOut: milesAmountOut,
    slippage: form.slippage,
    toTokenDecimals: form.toToken?.decimals ?? null,
    barterPreGasOutputAmount: form.barterPreGasOutputAmount,
    toTokenPrice: form.toPrice,
    ethPrice: form.ethPrice,
    isEthOutput,
    baseFeePerGas,
    isPermitPath: !!isPermitPath && !form.isWrapUnwrap,
    outputTokenAddress: form.toToken?.address ?? null,
    enabled:
      !form.isWrapUnwrap &&
      !!form.amount &&
      !!form.displayQuote &&
      !!form.fromToken &&
      !!form.toToken,
    isBarterValidating: form.isBarterValidating,
    // Synchronous identity of the user's swap inputs. Changes the instant
    // the user clicks a percentage button or types a new amount — used by
    // the estimator to clear cached miles/surplus-rate refs so prior-amount
    // values don't leak into the new amount during the validation window.
    swapIdentityKey: `${form.amount}|${form.fromToken?.address ?? ""}|${form.toToken?.address ?? ""}`,
  })

  // Keep estimation behind the feature flag for UI, but always log to console
  const estimatedMiles = FEATURE_FLAGS.show_miles_estimate ? rawEstimatedMiles : null

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [autoExecuteSwap, setAutoExecuteSwap] = useState(false)
  const lastTxError = useSwapToastStore((s) => s.lastTxError)
  const retrySlippage = useSwapToastStore((s) => s.retrySlippage)
  const clearRetrySlippage = useSwapToastStore((s) => s.clearRetrySlippage)

  // Reopen confirmation modal when a tx fails after submit (e.g. status 0x0)
  useEffect(() => {
    if (lastTxError) setIsConfirmationOpen(true)
  }, [lastTxError])

  // Barter slippage retry: update slippage, fetch fresh quote, then auto-execute
  const [pendingRetry, setPendingRetry] = useState(false)

  useEffect(() => {
    if (retrySlippage) {
      form.updateSlippage(retrySlippage)
      clearRetrySlippage()
      setIsConfirmationOpen(false)
      setPendingRetry(true)
      form.refetchQuote()
    }
  }, [retrySlippage, clearRetrySlippage, form])

  // Wait for fresh quote to arrive before opening modal with auto-execute
  useEffect(() => {
    if (pendingRetry && !form.isQuoteLoading) {
      setPendingRetry(false)
      setAutoExecuteSwap(true)
      requestAnimationFrame(() => setIsConfirmationOpen(true))
    }
  }, [pendingRetry, form.isQuoteLoading])
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

  // Stable references for the calc callbacks so their identity doesn't
  // churn each render (`form` is rebuilt every render but its inner
  // setters / updateSlippage / resetSlippage are stable useCallbacks).
  const { updateSlippage, resetSlippage } = form
  const formSlippageRef = useRef(form.slippage)
  formSlippageRef.current = form.slippage

  // Tracks the slippage value the miles calc most recently applied. Used to
  // flip the buy card into "miles applied" mode (different label + min-out
  // display) so the user can see the cost of the miles they targeted.
  // Cleared whenever the user moves slippage off the calc value, switches
  // tokens, or completes a swap.
  const [milesAppliedSlippage, setMilesAppliedSlippage] = useState<string | null>(null)
  // Lifted so the no-miles message in ExchangeRate can open the calc directly.
  const [isCalcOpen, setIsCalcOpen] = useState(false)

  const handleApplyMilesCalc = useCallback(
    ({ slippage }: { slippage: string }) => {
      // Calculator only adjusts slippage — never changes the user's typed
      // sell/buy amounts. The required slippage flips us into custom mode
      // (which is what `updateSlippage` does); user can switch back to auto.
      if (slippage && slippage !== formSlippageRef.current) {
        updateSlippage(slippage)
      }
      setMilesAppliedSlippage(slippage)
    },
    [updateSlippage]
  )

  // Calc closed → drop calc-applied slippage and return to auto mode. The
  // calc's bumped value was scoped to the calc session.
  const handleCloseMilesCalc = useCallback(() => {
    resetSlippage()
    setMilesAppliedSlippage(null)
  }, [resetSlippage])

  // One-click "Revert" from the BuyCard: collapse the calc badge, drop
  // slippage back to auto, and clear the marker. Same reset the X-close
  // path does — exposed as a callback so the buy card can offer it inline.
  const handleRevertMiles = useCallback(() => {
    setIsCalcOpen(false)
    resetSlippage()
    setMilesAppliedSlippage(null)
  }, [resetSlippage])

  // Drop the miles-applied marker the moment slippage drifts away from
  // the calc-applied value (manual edit in settings, retry-with-slippage,
  // auto-bump kicking back in, etc.). Without this the buy card would lie.
  useEffect(() => {
    if (milesAppliedSlippage != null && form.slippage !== milesAppliedSlippage) {
      setMilesAppliedSlippage(null)
    }
  }, [form.slippage, milesAppliedSlippage])

  // Flipping slippage mode FROM custom BACK to auto while the calculator is
  // open means the calc-applied slippage is no longer in effect — close the
  // calculator so the badge collapses to its baseline state. Tracked as a
  // transition (not steady state) so the default auto mode doesn't slam the
  // calc closed the moment the user opens it.
  const prevSlippageModeRef = useRef(form.mode)
  useEffect(() => {
    const prev = prevSlippageModeRef.current
    prevSlippageModeRef.current = form.mode
    if (prev === "custom" && form.mode === "auto" && isCalcOpen) {
      setIsCalcOpen(false)
      setMilesAppliedSlippage(null)
    }
  }, [form.mode, isCalcOpen])

  // Token switch → calc resets, so the marker should too.
  useEffect(() => {
    setMilesAppliedSlippage(null)
  }, [form.fromToken?.address, form.toToken?.address])

  // Successful swap → marker resets along with the rest of the form.
  const lastResetCountRef = useRef(form.swapResetCount)
  useEffect(() => {
    if (form.swapResetCount !== lastResetCountRef.current) {
      lastResetCountRef.current = form.swapResetCount
      setMilesAppliedSlippage(null)
    }
  }, [form.swapResetCount])

  const milesApplied = milesAppliedSlippage != null

  return (
    <div className="relative flex flex-col items-center justify-start w-full min-h-[320px]">
      <SwapInterface
        // Settings Props
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        slippage={form.slippage}
        handleSlippageChange={form.updateSlippage}
        commitSlippage={form.commitSlippage}
        internalDeadline={form.deadline}
        setInternalDeadline={form.updateDeadline}
        isMounted={form.isMounted}
        slippageMode={form.mode}
        setSlippageMode={form.setMode}
        slippageCustomMin={form.customMin}
        slippageAutoBase={form.autoBase}
        slippageAutoBumpedForGas={form.autoBumpedForGas}
        slippageWarning={form.slippageWarning}
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
              : form.displayedAmountOutFormatted || ""
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
        outputAmount={form.isWrapUnwrap ? form.amount : form.displayedAmountOutFormatted || "0"}
        setAmount={form.setAmount}
        editingSide={form.editingSide}
        setEditingSide={form.setEditingSide}
        handleSwitch={form.handleSwitch}
        handleSwapClick={handleSwapClick}
        isConnected={isConnected}
        isNonceLoading={isPermitPath ? isNonceLoading : false}
        address={address}
        insufficientBalance={
          form.editingSide === "buy" && form.displayQuote
            ? parseFloat(form.displayQuote.amountInFormatted.replace(/,/g, "") || "0") >
              form.fromBalanceValue
            : parseFloat(form.amount || "0") > form.fromBalanceValue
        }
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
        barterAmountTooSmall={form.barterAmountTooSmall}
        barterUnavailable={form.barterUnavailable}
        isBarterValidating={form.isBarterValidating}
        estimatedMiles={estimatedMiles}
        milesToSlippage={milesToSlippage}
        maxAchievableMiles={maxAchievableMiles}
        swapResetCount={form.swapResetCount}
        onApplyMilesCalc={handleApplyMilesCalc}
        onCloseMilesCalc={handleCloseMilesCalc}
        onRevertMiles={handleRevertMiles}
        milesApplied={milesApplied}
        computedMinAmountOut={form.computedMinAmountOut ?? null}
        isCalcOpen={isCalcOpen}
        setIsCalcOpen={setIsCalcOpen}
      />

      {/* From Token Selector Modal */}
      <TokenSelectorModal
        open={isFromSelectorOpen}
        onOpenChange={setIsFromSelectorOpen}
        selectedToken={form.fromToken?.symbol}
        excludeAddress={form.toToken?.address?.toLowerCase()}
        onSelectToken={(token) => form.setFromToken(token)}
      />

      {/* To Token Selector Modal */}
      <TokenSelectorModal
        open={isToSelectorOpen}
        onOpenChange={setIsToSelectorOpen}
        selectedToken={form.toToken?.symbol}
        excludeAddress={form.fromToken?.address?.toLowerCase()}
        onSelectToken={(token) => form.setToToken(token)}
      />

      {form.fromToken && form.toToken && (
        <SwapConfirmationModal
          key={`${form.fromToken.address}-${form.toToken.address}`}
          open={isConfirmationOpen}
          onOpenChange={(isOpen) => {
            setIsConfirmationOpen(isOpen)
            if (!isOpen) form.resetSlippage()
          }}
          tokenIn={form.fromToken}
          tokenOut={form.toToken}
          amountIn={
            !form.isWrapUnwrap && form.editingSide === "buy"
              ? form.displayQuote?.amountInFormatted?.replace(/,/g, "") || "0"
              : form.amount
          }
          amountOut={
            form.isWrapUnwrap ? form.amount : form.displayedAmountOutFormatted || form.amount
          }
          minAmountOut={form.isWrapUnwrap ? form.amount : form.computedMinAmountOut || ""}
          slippageLimitFormatted={
            form.isWrapUnwrap
              ? form.amount
              : form.displayQuote?.slippageLimitFormatted || form.amount
          }
          isMaxIn={form.isWrapUnwrap ? false : (form.displayQuote?.isMaxIn ?? false)}
          exchangeRate={form.isWrapUnwrap ? 1 : form.displayQuote?.exchangeRate || 1}
          priceImpact={form.isWrapUnwrap ? 0 : form.displayQuote?.priceImpact || 0}
          slippage={form.slippage}
          autoAdjustedForGas={form.autoBumpedForGas}
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
          setClearSwapState={form.setClearSwapState}
          needsPermit2Approval={form.needsPermit2Approval}
          isApproving={form.isApproving}
          isApprovalRejected={form.isApprovalRejected}
          approvalTxHash={form.approvalTxHash}
          onApprove={form.approvePermit2}
          approveTokenSymbol={form.approveTokenSymbol}
          estimatedMiles={estimatedMiles}
          milesApplied={milesApplied}
          externalError={lastTxError}
          onRetryWithSlippage={(newSlippage) => {
            form.updateSlippage(newSlippage)
            setIsConfirmationOpen(false)
            requestAnimationFrame(() => setIsConfirmationOpen(true))
          }}
          autoExecute={autoExecuteSwap}
          onAutoExecuteConsumed={() => setAutoExecuteSwap(false)}
        />
      )}
    </div>
  )
}
