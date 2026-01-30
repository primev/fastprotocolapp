"use client"

import React, { useEffect, useMemo, useCallback, useState } from "react"
import NumberFlow from "@number-flow/react"
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn, formatAmountByTokenType } from "@/lib/utils"
import { isStablecoin } from "@/lib/stablecoins"
import { useGasPrice } from "@/hooks/use-gas-price"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  Fuel,
  AlertTriangle,
} from "lucide-react"
import type { Token } from "@/types/swap"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { useSwapConfirmation } from "@/hooks/use-swap-confirmation"
import { getPriceImpactSeverity } from "@/hooks/use-swap-quote"
import { getTransactionErrorMessage, getTransactionErrorTitle } from "@/lib/transaction-errors"

interface SwapConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenIn: Token | undefined
  tokenOut: Token | undefined
  amountIn: string
  /** Expected receive amount (price without slippage). Shown in the main Receive card. */
  amountOut: string
  /** Minimum output / max input we accept (contract value). Passed to useSwapConfirmation. */
  minAmountOut: string
  /** Formatted slippage-limited value for the "Minimum received" / "Maximum sold" detail row. */
  slippageLimitFormatted: string
  /** true = exactOut: show "Maximum sold" (tokenIn). false = exactIn: show "Minimum received" (tokenOut). */
  isMaxIn?: boolean
  exchangeRate: number
  priceImpact: number
  slippage: string
  /** Transaction deadline in minutes (5–1440). Passed to useSwapConfirmation. */
  deadline: number
  gasEstimate: bigint | null
  ethPrice?: number | null
  timeLeft?: number
  isLoading?: boolean
  refreshBalances?: () => Promise<void>
}

interface InfoRowProps {
  label: string
  value: React.ReactNode
  tooltip?: string
  valueClassName?: string
}

function InfoRow({ label, value, tooltip, valueClassName }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
          {label}
        </span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-white/40 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] bg-[#1c2128] border-white/10">
                <p className="text-xs text-gray-300">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider text-white/80",
          valueClassName,
          label === "Minimum received" || label === "Maximum sold" ? "text-emerald-400" : undefined
        )}
      >
        {value}
      </span>
    </div>
  )
}

function BuyReceiveValue({ value, className }: { value: string; className?: string }) {
  const clean = value?.replace(/,/g, "") ?? ""
  const numeric = clean && !Number.isNaN(parseFloat(clean)) ? parseFloat(clean) : null
  const decimalPlaces = clean.includes(".") ? (clean.split(".")[1]?.length ?? 0) : 0
  const minFractionDigits = Math.min(decimalPlaces, 6)

  if (numeric === null) {
    return <span className={className}>{value || "0"}</span>
  }

  return (
    <span className={className}>
      <NumberFlow
        value={numeric}
        format={{
          minimumFractionDigits: minFractionDigits,
          maximumFractionDigits: 6,
        }}
        style={
          {
            "--number-flow-char-gap": "-0.5px",
            "--number-flow-mask-duration": "0.3s",
            "--number-flow-mask-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
            fontVariantNumeric: "tabular-nums",
          } as React.CSSProperties
        }
      />
    </span>
  )
}

function SwapConfirmationModal({
  open,
  onOpenChange,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  minAmountOut,
  slippageLimitFormatted,
  isMaxIn = false,
  exchangeRate,
  priceImpact,
  slippage,
  deadline,
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
    deadline,
    onSuccess: () => {
      if (refreshBalances) {
        setTimeout(() => refreshBalances(), 1000)
      }
    },
  })

  const { gasPrice } = useGasPrice()
  const [isExpanded, setIsExpanded] = useState(false)

  // Reset accordion when modal closes so it starts collapsed on next open
  useEffect(() => {
    if (!open) setIsExpanded(false)
  }, [open])

  // --- LOGIC PHASES ---
  const isWaitingForSignature = isWrapPending || isSigning
  const isWaitingForBlock = isWrapConfirming || isSubmitting
  const isSwapSuccess = !!swapHash && !isSigning && !isSubmitting
  const isCurrentlySuccess = isWrapSuccess || isSwapSuccess
  const isCurrentlyError = !!wrapError
  const activeHash = wrapHash || swapHash

  const isActive =
    isWaitingForSignature || isWaitingForBlock || isCurrentlySuccess || isCurrentlyError
  const operationType = isWrap ? "wrap" : isUnwrap ? "unwrap" : "swap"
  const impactSeverity = useMemo(
    () => (isWrap || isUnwrap ? "low" : getPriceImpactSeverity(priceImpact)),
    [isWrap, isUnwrap, priceImpact]
  )

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
        className="max-w-[480px] max-h-[90dvh] bg-[#1c1c1c] p-2 overflow-y-auto overflow-x-hidden gap-0 rounded-[28px] border-0 outline-none ring-0 shadow-2xl [&>button]:hidden"
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
                <BuyReceiveValue
                  value={amountIn}
                  className="text-2xl font-bold text-white tabular-nums"
                />
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 top-[50%] -translate-y-1/2 z-10">
                <div className="p-2 bg-[#1c1c1c] border-[6px] border-[#1c1c1c] rounded-2xl ring-1 ring-white/15">
                  <ArrowDown size={18} className="text-white/45" />
                </div>
              </div>

              <div className="bg-[#1c1c1c]/60 border border-white/10 rounded-2xl p-5 flex items-center justify-between mt-2">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white">{tokenOut?.symbol}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-white/50">
                    Receive
                  </span>
                </div>
                <BuyReceiveValue value={amountOut} className="text-2xl font-bold tabular-nums" />
              </div>
            </div>

            <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-5">
              <div className="divide-y divide-white/5">
                {impactSeverity === "high" ? (
                  <InfoRow
                    label="Price impact"
                    value={
                      <span className="flex items-center gap-1.5">
                        {`${priceImpact >= 0 ? "" : "-"}${Math.abs(priceImpact).toFixed(2)}%`}
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-help">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-[200px] bg-[#1c2128] border-white/10"
                            >
                              <p className="font-semibold text-red-400 mb-1">High Price Impact</p>
                              <p className="text-xs text-gray-300">
                                This trade will significantly move the market price. You may receive
                                less than expected.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    }
                    tooltip="The difference between market price and estimated price due to trade size"
                    valueClassName="text-red-400"
                  />
                ) : (
                  <InfoRow
                    label="Fee"
                    value="Free"
                    tooltip="The fee charged for this swap"
                    valueClassName="text-primary"
                  />
                )}
                <InfoRow
                  label="Network cost"
                  value={
                    <span className="flex items-center gap-1.5">
                      <Fuel className="h-3.5 w-3.5 text-white/40" />
                      {gasCostUsd ? `$${gasCostUsd.toFixed(2)}` : "—"}
                    </span>
                  }
                  tooltip="Estimated gas fee for this transaction"
                />
                <InfoRow
                  label={isMaxIn ? "Maximum sold" : "Minimum received"}
                  value={`${slippageLimitFormatted} ${isMaxIn ? (tokenIn?.symbol ?? "") : (tokenOut?.symbol ?? "")}`}
                  tooltip={
                    isMaxIn
                      ? "The maximum amount you will pay after slippage"
                      : "The minimum amount you will receive after slippage"
                  }
                />
              </div>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-2 rounded-lg hover:bg-white/5 transition-all text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white/80"
              >
                {isExpanded ? "Show less" : "Show more"}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  isExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="divide-y divide-white/5 pt-2">
                  <InfoRow
                    label="Rate"
                    value={`1 ${tokenIn?.symbol ?? ""} = ${formatAmountByTokenType(
                      exchangeRate,
                      isStablecoin(tokenIn?.address ?? "", tokenIn?.symbol) ||
                        isStablecoin(tokenOut?.address ?? "", tokenOut?.symbol)
                    )} ${tokenOut?.symbol ?? ""}`}
                    tooltip="Current exchange rate between tokens"
                  />
                  <InfoRow
                    label="Max slippage"
                    value={
                      <span className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold uppercase">
                          Auto
                        </span>
                        {slippage}%
                      </span>
                    }
                    tooltip="Maximum price movement allowed before transaction reverts"
                  />
                  <InfoRow
                    label="Order routing"
                    value="Fast Protocol"
                    tooltip="Protocol used to execute this swap"
                  />
                  {impactSeverity === "high" ? (
                    <InfoRow
                      label="Fee"
                      value="Free"
                      tooltip="The fee charged for this swap"
                      valueClassName="text-primary"
                    />
                  ) : (
                    <InfoRow
                      label="Price impact"
                      value={
                        <span className="flex items-center gap-1.5">
                          {`${priceImpact >= 0 ? "" : "-"}${Math.abs(priceImpact).toFixed(2)}%`}
                          {impactSeverity === "medium" && (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex cursor-help">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="max-w-[200px] bg-[#1c2128] border-white/10"
                                >
                                  <p className="font-semibold text-amber-400 mb-1">
                                    Medium Price Impact
                                  </p>
                                  <p className="text-xs text-gray-300">
                                    This trade may move the market price. Consider a smaller amount.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                      }
                      tooltip="The difference between market price and estimated price due to trade size"
                      valueClassName={cn(
                        impactSeverity === "low" && "text-emerald-400",
                        impactSeverity === "medium" && "text-amber-400"
                      )}
                    />
                  )}
                </div>
                {timeLeft != null && (
                  <div className="border-t border-white/5 pt-2 mt-2">
                    <InfoRow
                      label="Quote expires"
                      value={
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          <span className="tabular-nums">{timeLeft}s</span>
                        </span>
                      }
                      tooltip="Time until this quote expires"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => (isWrap ? wrap() : isUnwrap ? unwrap() : confirmSwap())}
                disabled={isLoading}
                className={cn(
                  "w-full h-16 font-black uppercase tracking-[0.2em] text-sm rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all",
                  !isWrap && !isUnwrap && impactSeverity === "high"
                    ? "bg-red-500 text-white"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {isLoading
                  ? "Fetching..."
                  : !isWrap && !isUnwrap && impactSeverity === "high"
                    ? "Swap Anyway"
                    : `Confirm ${operationType}`}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default React.memo(SwapConfirmationModal)
