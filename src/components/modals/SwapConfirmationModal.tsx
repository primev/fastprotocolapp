"use client"

import React, { useEffect, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useGasPrice } from "@/hooks/use-gas-price"
import {
  ArrowDown,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  Info,
  ExternalLink,
} from "lucide-react"
import type { Token } from "@/types/swap"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { useSwapConfirmation } from "@/hooks/use-swap-confirmation"
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
  // --- EXTERNAL HOOKS ---
  const {
    isWrap,
    isUnwrap,
    wrap,
    unwrap,
    isPending: isWrapPending, // Wallet Signature Phase
    isConfirming: isWrapConfirming, // Blockchain Inclusion Phase
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
    isSigning, // Wallet Signature Phase
    isSubmitting, // Blockchain Inclusion Phase
    hash: swapHash,
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

  // --- LOGIC PHASES ---
  const isWaitingForSignature = isWrapPending || isSigning
  const isWaitingForBlock = isWrapConfirming || isSubmitting
  const isCurrentlySuccess = isWrapSuccess // Note: Add swapSuccess here if useSwapConfirmation provides it
  const isCurrentlyError = !!wrapError
  const activeHash = wrapHash || swapHash

  const isActive =
    isWaitingForSignature || isWaitingForBlock || isCurrentlySuccess || isCurrentlyError
  const operationType = isWrap ? "wrap" : isUnwrap ? "unwrap" : "swap"

  // --- ACTIONS ---
  const resetAllStates = useCallback(() => {
    if (resetWrap) resetWrap()
    if (resetSwap) resetSwap()
  }, [resetWrap, resetSwap])

  const handleOpenChange = (isOpen: boolean) => {
    // BLOCK CLOSING during active transaction phases
    if (!isOpen && (isWaitingForSignature || isWaitingForBlock)) return

    if (!isOpen) {
      if (isCurrentlySuccess && refreshBalances) refreshBalances()
      resetAllStates()
    }
    onOpenChange(isOpen)
  }

  // --- GAS CALCULATION ---
  const gasCostUsd = useMemo(() => {
    if (!gasEstimate || !gasPrice) return null
    const price = ethPrice || 3200
    return (Number(gasEstimate) * Number(gasPrice) * price) / 1e18
  }, [gasEstimate, gasPrice, ethPrice])

  const errorTitle = useMemo(
    () => getTransactionErrorTitle(wrapError, operationType),
    [wrapError, operationType]
  )
  const shortErrorMessage = useMemo(
    () => getTransactionErrorMessage(wrapError, operationType),
    [wrapError, operationType]
  )

  // Refresh balances when wrap/unwrap succeeds
  useEffect(() => {
    if (isWrapSuccess && refreshBalances) {
      // Small delay to ensure transaction is fully confirmed on-chain
      const timeoutId = setTimeout(() => {
        refreshBalances()
      }, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [isWrapSuccess, refreshBalances])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogOverlay className="bg-black/60 backdrop-blur-md transition-all duration-300" />
      <DialogContent
        className="max-w-[480px] bg-[#1c1c1c] p-2 overflow-hidden gap-0 rounded-[28px] border-0 outline-none ring-0 shadow-2xl [&>button]:hidden"
        // PREVENT CLICK OUTSIDE & ESCAPE
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* HEADER */}
        <div className="relative flex items-center justify-between bg-[#1c1c1c]/60 h-[54px] py-3 px-4 mb-4">
          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent"></div>
          <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/45">
            {isCurrentlyError
              ? errorTitle
              : isActive
                ? "Transaction Status"
                : `Confirm ${operationType}`}
          </DialogTitle>

          {/* Hide Close Button while processing */}
          {!(isWaitingForSignature || isWaitingForBlock) && (
            <button
              onClick={() => handleOpenChange(false)}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/5 transition-colors group"
            >
              <X size={18} className="text-white/55 group-hover:text-white/90 transition-colors" />
            </button>
          )}
        </div>

        {isActive ? (
          /* STATUS VIEW */
          <div className="flex flex-col items-center py-10 px-8 text-center animate-in fade-in zoom-in-95 duration-300">
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
                <div className="relative">
                  <Loader2 className="h-20 w-20 text-primary animate-spin relative z-10" />
                  {isWaitingForBlock && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 mb-8">
              <h3
                className={cn(
                  "text-xl font-bold uppercase tracking-tight",
                  isCurrentlyError ? "text-red-500" : "text-white"
                )}
              >
                {isCurrentlySuccess
                  ? "Confirmed"
                  : isCurrentlyError
                    ? "Failed"
                    : isWaitingForBlock
                      ? "Processing Transaction"
                      : "Sign Transaction"}
              </h3>
              <p className="text-[14px] font-medium text-white/75 max-w-[320px] leading-relaxed">
                {isCurrentlySuccess
                  ? "Transaction successfully completed."
                  : isCurrentlyError
                    ? shortErrorMessage
                    : isWaitingForBlock
                      ? "Waiting for network confirmation..."
                      : "Please confirm the request in your wallet."}
              </p>
            </div>

            {activeHash && (
              <a
                href={`https://etherscan.io/tx/${activeHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 mb-8 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
              >
                View on Explorer <ExternalLink size={12} />
              </a>
            )}

            <div className="flex flex-col w-full gap-3">
              {isCurrentlyError && (
                <button
                  onClick={resetAllStates}
                  className="w-full h-14 bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl transition-all flex items-center justify-center gap-3"
                >
                  <RefreshCw size={16} /> Try Again
                </button>
              )}
              {(isCurrentlySuccess || isCurrentlyError) && (
                <button
                  onClick={() => handleOpenChange(false)}
                  className="w-full py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 hover:text-white/70 transition-colors"
                >
                  Close Window
                </button>
              )}
            </div>
          </div>
        ) : (
          /* REVIEW VIEW */
          <div className="px-4 pb-6 space-y-6 animate-in fade-in duration-300">
            <div className="relative">
              <div className="bg-[#1c1c1c]/60 border border-white/10 rounded-2xl p-5 flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white">{tokenIn?.symbol}</span>
                  <span className="text-[10px] text-white/50 uppercase font-bold tracking-widest">
                    Pay
                  </span>
                </div>
                <span className="text-2xl font-bold text-white tabular-nums">{amountIn}</span>
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 top-[50%] -translate-y-1/2 z-10">
                <div className="p-2 bg-[#1c1c1c] border-[6px] border-[#1c1c1c] rounded-2xl ring-1 ring-white/15">
                  <ArrowDown size={18} className="text-white/45" />
                </div>
              </div>

              <div className="bg-[#1c1c1c]/60 border border-white/10 rounded-2xl p-5 flex items-center justify-between mt-2">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white">{tokenOut?.symbol}</span>
                  <span className="text-[10px] text-emerald-500/50 uppercase font-bold tracking-widest">
                    Receive
                  </span>
                </div>
                <span className="text-2xl font-bold text-emerald-500 tabular-nums">
                  {minAmountOut}
                </span>
              </div>
            </div>

            <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <span className="text-white/50">Network Cost</span>
                <span className="text-white/80">
                  {gasCostUsd ? `$${gasCostUsd.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <span className="text-white/50">Max Slippage</span>
                <span className="text-white/80">{slippage}%</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => (isWrap ? wrap() : isUnwrap ? unwrap() : confirmSwap())}
                disabled={isLoading}
                className="w-full h-16 bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] text-sm rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {isLoading ? "Fetching..." : `Confirm ${operationType}`}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default React.memo(SwapConfirmationModal)
