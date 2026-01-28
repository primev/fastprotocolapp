"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import * as Accordion from "@radix-ui/react-accordion"
import { cn } from "@/lib/utils"
import { formatPriceImpact, getPriceImpactSeverity } from "@/hooks/use-quote"
import { useGasPrice } from "@/hooks/use-gas-price"
import {
  ArrowDown,
  X,
  Loader2,
  CheckCircle2,
  ExternalLink,
  XCircle,
  RefreshCw,
  ChevronDown,
  Info,
  AlertTriangle,
} from "lucide-react"
import type { Token } from "@/types/swap"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { useSwapConfirmation } from "@/hooks/use-swap-confirmation"

// Centralized error utilities
import { getTransactionErrorMessage, getTransactionErrorTitle } from "@/lib/transaction-errors"

interface SwapConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenIn: Token | undefined
  tokenOut: Token | undefined
  amountIn: string
  amountOut: string
  minAmountOut: string
  exchangeRate: number
  priceImpact: number
  slippage: string
  gasEstimate: bigint | null
  ethPrice?: number | null
  timeLeft?: number
  isLoading?: boolean
  refreshBalances?: () => Promise<void>
}

function SwapConfirmationModal({
  open,
  onOpenChange,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  minAmountOut,
  exchangeRate,
  priceImpact,
  slippage,
  gasEstimate,
  ethPrice,
  timeLeft,
  isLoading = false,
  refreshBalances,
}: SwapConfirmationModalProps) {
  // --- INTERNAL UI SIMULATION STATES ---
  const [testMode, setTestMode] = useState(false)
  const [testStatus, setTestStatus] = useState<
    "idle" | "pending" | "confirming" | "success" | "error"
  >("idle")
  const [testErrorObject, setTestErrorObject] = useState<any>(null)

  // --- EXTERNAL HOOKS ---
  const {
    isWrap,
    isUnwrap,
    wrap,
    unwrap,
    isPending: isWrapPending,
    isConfirming: isWrapConfirming,
    isSuccess: isWrapSuccess,
    error: wrapError,
    hash: wrapHash,
    reset: resetWrap,
  } = useWethWrapUnwrap({
    fromToken: tokenIn,
    toToken: tokenOut,
    amount: amountIn,
  })

  const {
    confirmSwap,
    isSigning,
    isSubmitting,
    reset: resetSwap,
  } = useSwapConfirmation({
    fromToken: tokenIn,
    toToken: tokenOut,
    amount: amountIn,
    minAmountOut,
    deadline: 0,
    onSuccess: () => {
      if (refreshBalances) {
        setTimeout(() => refreshBalances(), 1000)
      }
    },
  })

  const { gasPrice } = useGasPrice()

  // --- TOP-LEVEL SCOPED VARIABLES ---
  const operationType = isWrap ? "wrap" : isUnwrap ? "unwrap" : "swap"
  const priceImpactSeverity = getPriceImpactSeverity(priceImpact)

  // Consolidating all "Active" and "Error" states
  const isCurrentlyPending = isWrapPending || isSigning || (testMode && testStatus === "pending")
  const isCurrentlyConfirming =
    isWrapConfirming || isSubmitting || (testMode && testStatus === "confirming")
  const isCurrentlySuccess = isWrapSuccess || (testMode && testStatus === "success")
  const isCurrentlyError = !!wrapError || (testMode && testStatus === "error")

  // The 'isActive' flag determines if we show the Status screen or the Review screen
  const isActive =
    isCurrentlyPending || isCurrentlyConfirming || isCurrentlySuccess || isCurrentlyError

  // --- RESET LOGIC ---
  const resetAllStates = useCallback(() => {
    // 1. Reset Internal Test States
    setTestMode(false)
    setTestStatus("idle")
    setTestErrorObject(null)

    // 2. Reset External Hook States (Crucial for live mode)
    if (resetWrap) resetWrap()
    if (resetSwap) resetSwap()
  }, [resetWrap, resetSwap])

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && isCurrentlySuccess && refreshBalances) {
      // Refresh balances one more time when closing after success
      refreshBalances()
    }
    if (!isOpen) {
      resetAllStates()
    }
    onOpenChange(isOpen)
  }

  // --- Balance Refresh on Wrap/Unwrap Success ---
  useEffect(() => {
    if (isWrapSuccess && refreshBalances) {
      // Small delay to ensure transaction is fully confirmed
      setTimeout(() => {
        refreshBalances()
      }, 1000)
    }
  }, [isWrapSuccess, refreshBalances])

  // --- ERROR FORMATTING ---
  const activeError = testMode ? testErrorObject : wrapError

  const errorTitle = useMemo(() => {
    return getTransactionErrorTitle(activeError, operationType)
  }, [activeError, operationType])

  const shortErrorMessage = useMemo(() => {
    return getTransactionErrorMessage(activeError, operationType)
  }, [activeError, operationType])

  const fullErrorDetails = useMemo(() => {
    if (!activeError) return ""
    return activeError instanceof Error ? activeError.message : String(activeError)
  }, [activeError])

  // --- MODAL TITLE (Scoped for entire component) ---
  const modalTitle = useMemo(() => {
    if (isCurrentlyError) return errorTitle
    if (isActive) return "Transaction Status"
    if (isWrap) return "Wrap ETH"
    if (isUnwrap) return "Unwrap WETH"
    return "Swap Confirmation"
  }, [isCurrentlyError, errorTitle, isActive, isWrap, isUnwrap])

  // --- GAS ---
  const gasCostUsd = useMemo(() => {
    if (!gasEstimate || !gasPrice) return null
    const price = ethPrice || 3200
    return (Number(gasEstimate) * Number(gasPrice) * price) / 1e18
  }, [gasEstimate, gasPrice, ethPrice])

  const handleConfirmAction = () => {
    // Simulation logic for testing UI
    const ENABLE_TEST_SIMULATION = false
    const SIMULATE_FAILURE = false

    if (ENABLE_TEST_SIMULATION) {
      setTestMode(true)
      setTestStatus("pending")
      setTimeout(() => {
        if (SIMULATE_FAILURE) {
          setTestStatus("error")
          setTestErrorObject(
            new Error(
              "Execution reverted: UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT. Market volatility exceeded your slippage settings."
            )
          )
        } else {
          setTestStatus("confirming")
          setTimeout(() => setTestStatus("success"), 1500)
        }
      }, 800)
    } else {
      if (isWrap) wrap()
      else if (isUnwrap) unwrap()
      else confirmSwap()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogOverlay className="bg-black/40 backdrop-blur-sm transition-all duration-300" />
      <DialogContent className="max-w-[480px] bg-[#131313] p-2 overflow-hidden gap-0 rounded-[28px] border-0 outline-none ring-0 shadow-2xl [&>button]:hidden">
        {/* MODAL HEADER */}
        <div className="relative flex items-center justify-between bg-[#131313]/50 h-[54px] py-3 px-4 mb-4">
          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"></div>
          <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/20">
            {modalTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isWrap
              ? "Wrap ETH to WETH"
              : isUnwrap
                ? "Unwrap WETH to ETH"
                : "Confirm swap transaction"}
          </DialogDescription>
          <button
            onClick={() => handleOpenChange(false)}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/5 transition-colors group"
          >
            <X size={18} className="text-white/40 group-hover:text-white/80 transition-colors" />
          </button>
        </div>

        {isActive ? (
          /* STATUS SCREEN: PENDING / SUCCESS / ERROR */
          <div className="flex flex-col items-center py-10 px-8 text-center animate-in fade-in zoom-in-95 duration-300">
            {/* STATUS ICON */}
            <div className="relative mb-8">
              <div
                className={cn(
                  "absolute inset-0 blur-3xl rounded-full scale-150 opacity-40 transition-colors duration-500",
                  isCurrentlySuccess
                    ? "bg-emerald-500"
                    : isCurrentlyError
                      ? "bg-red-500"
                      : "bg-primary"
                )}
              />
              {isCurrentlySuccess ? (
                <CheckCircle2 className="h-20 w-20 text-emerald-500 relative z-10" />
              ) : isCurrentlyError ? (
                <XCircle className="h-20 w-20 text-red-500 relative z-10" />
              ) : (
                <Loader2 className="h-20 w-20 text-primary animate-spin relative z-10" />
              )}
            </div>

            {/* STATUS TEXT */}
            <div className="space-y-3 mb-10">
              <h3
                className={cn(
                  "text-xl font-bold uppercase tracking-tight",
                  isCurrentlyError ? "text-red-500" : "text-white"
                )}
              >
                {isCurrentlySuccess ? "Confirmed" : isCurrentlyError ? "Failed" : "Processing"}
              </h3>
              <p className="text-[14px] font-medium text-white/60 max-w-[340px] leading-relaxed">
                {isCurrentlySuccess
                  ? "Transaction was successfully broadcast and confirmed."
                  : isCurrentlyError
                    ? shortErrorMessage
                    : "Authorize the transaction in your wallet."}
              </p>
            </div>

            {/* RADIX ACCORDION FOR ERRORS */}
            {isCurrentlyError && fullErrorDetails && (
              <Accordion.Root type="single" collapsible className="w-full mb-8">
                <Accordion.Item
                  value="error-details"
                  className="bg-red-500/[0.03] border border-red-500/10 rounded-2xl overflow-hidden"
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="group w-full flex items-center justify-between p-4 hover:bg-red-500/[0.06] transition-all">
                      <div className="flex items-center gap-2.5">
                        <Info size={14} className="text-red-400/80" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-400/80">
                          Technical Details
                        </span>
                      </div>
                      <ChevronDown
                        size={14}
                        className="text-red-400/60 transition-transform duration-300 group-data-[state=open]:rotate-180"
                      />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <div className="px-4 pb-4">
                      <div className="pt-2 border-t border-red-500/10 text-left">
                        <p className="text-[11px] font-mono text-red-400/70 break-words bg-black/40 p-4 rounded-xl border border-red-500/5 leading-relaxed">
                          {fullErrorDetails}
                        </p>
                      </div>
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              </Accordion.Root>
            )}

            {/* STATUS VIEW BUTTONS */}
            <div className="flex flex-col w-full gap-3">
              {isCurrentlyError && (
                <button
                  onClick={resetAllStates}
                  className="w-full h-14 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <RefreshCw size={16} /> Try Again
                </button>
              )}
              <button
                onClick={() => handleOpenChange(false)}
                className="w-full py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/30 hover:text-white/60 transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          /* REVIEW SCREEN: BEFORE CONFIRMING */
          <div className="px-4 pb-6 space-y-6 animate-in fade-in duration-300">
            <div className="relative">
              {/* PAY TOKEN */}
              <div className="bg-[#131313]/50 border border-white/[0.04] rounded-2xl p-5 flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white tracking-tight">
                    {tokenIn?.symbol}
                  </span>
                  <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">
                    Pay
                  </span>
                </div>
                <span className="text-2xl font-bold text-white tabular-nums">{amountIn}</span>
              </div>

              {/* CENTER DECORATOR */}
              <div className="absolute left-1/2 -translate-x-1/2 top-[50%] -translate-y-1/2 z-10">
                <div className="p-2 bg-[#131313] border-[6px] border-[#131313] rounded-2xl shadow-xl">
                  <ArrowDown size={18} className="text-white/20" strokeWidth={3} />
                </div>
              </div>

              {/* RECEIVE TOKEN */}
              <div className="bg-[#131313]/50 border border-white/[0.04] rounded-2xl p-5 flex items-center justify-between mt-2">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white tracking-tight">
                    {tokenOut?.symbol}
                  </span>
                  <span className="text-[10px] text-emerald-500/50 uppercase font-bold tracking-widest">
                    Receive
                  </span>
                </div>
                <span className="text-2xl font-bold text-emerald-500 tabular-nums">
                  {minAmountOut}
                </span>
              </div>
            </div>

            {/* TRANSACTION SUMMARY */}
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <span className="text-white/30">Network Cost</span>
                <span className="text-white/70">
                  {gasCostUsd ? `$${gasCostUsd.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <span className="text-white/30">Price Impact</span>
                <span
                  className={cn(
                    priceImpactSeverity === "high"
                      ? "text-red-500"
                      : priceImpactSeverity === "medium"
                        ? "text-yellow-500"
                        : "text-emerald-500"
                  )}
                >
                  {formatPriceImpact(priceImpact)}
                </span>
              </div>
            </div>

            {/* PRIMARY ACTION */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleConfirmAction}
                disabled={isLoading}
                className="w-full h-16 bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] text-sm rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-lg"
              >
                {isLoading ? "Loading..." : `Confirm ${operationType}`}
              </button>
              <button
                onClick={() => handleOpenChange(false)}
                className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default React.memo(SwapConfirmationModal)
