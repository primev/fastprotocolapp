"use client"

import React from "react"
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatPriceImpact, getPriceImpactSeverity } from "@/hooks/use-quote"
import { useGasPrice } from "@/hooks/use-gas-price"
import { AlertTriangle, ArrowDown, X } from "lucide-react"
import type { Token } from "@/types/swap"

interface SwapConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
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
  isWrap?: boolean
  isUnwrap?: boolean
}

function SwapConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
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
  isWrap = false,
  isUnwrap = false,
}: SwapConfirmationModalProps) {
  const priceImpactSeverity = getPriceImpactSeverity(priceImpact)
  const hasHighPriceImpact = Math.abs(priceImpact) > 3
  const { gasPrice } = useGasPrice()

  const isWrapUnwrap = isWrap || isUnwrap
  const modalTitle = isWrap ? "Wrap ETH" : isUnwrap ? "Unwrap WETH" : "Swap Confirmation"
  const buttonText = isLoading
    ? "Executing Transaction..."
    : isWrap
      ? "Confirm Wrap"
      : isUnwrap
        ? "Confirm Unwrap"
        : "Confirm Swap"

  const gasCostUsd =
    gasEstimate && gasPrice && ethPrice
      ? (Number(gasEstimate) * Number(gasPrice) * ethPrice) / 1e18
      : gasEstimate && gasPrice
        ? (Number(gasEstimate) * Number(gasPrice) * 3000) / 1e18
        : null

  const gasEstimateUsd = gasCostUsd !== null ? `$${gasCostUsd.toFixed(2)}` : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/20" />
      <DialogContent className="max-w-[500px] bg-[#131313] backdrop-blur-xl p-2 overflow-hidden gap-0 rounded-[24px] [&>button]:hidden focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none border-0 outline-none ring-0 ring-offset-0">
        {/* Modal Header */}
        <div className="relative flex items-center justify-between bg-[#131313]/50 backdrop-blur-sm h-[54px] py-3 px-2 mb-4 overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"></div>
          <div className="flex-1">
            <DialogTitle className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/20">
              {modalTitle}
            </DialogTitle>
          </div>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <X size={16} className="text-white/60 hover:text-white/80" />
            </button>
          </div>
        </div>

        {/* Quote Refresh Status - Hide for wrap/unwrap */}
        {!isWrapUnwrap && (
          <>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  Live Quote
                </span>
              </div>
              <span className="text-xs font-mono text-white/40">{timeLeft || 15}s</span>
            </div>

            {/* Quote Refresh Progress Bar */}
            <div className="h-1.5 bg-[#1B1B1B] overflow-hidden relative rounded-full mb-6 mx-2">
              <div
                className={cn(
                  "h-full transition-all duration-1000 ease-linear rounded-full",
                  timeLeft && timeLeft <= 5
                    ? "bg-red-500 shadow-[0_0_10px_#ef4444]"
                    : "bg-emerald-500 shadow-[0_0_10px_#10b981]"
                )}
                style={{ width: `${((timeLeft || 15) / 15) * 100}%` }}
              />
            </div>
          </>
        )}

        {/* Main Content Container */}
        <div className="space-y-6">
          {/* Token Swap Display */}
          <div className="relative">
            {/* From Token (Sell) */}
            <div className="bg-[#131313]/50 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden">
                  {tokenIn?.logoURI ? (
                    <img
                      src={tokenIn.logoURI}
                      alt={tokenIn.symbol}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-primary/20" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white">{tokenIn?.symbol}</span>
                  {tokenIn?.name && (
                    <span className="text-xs text-white/50 truncate max-w-[120px]">
                      {tokenIn.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-white tabular-nums block">{amountIn}</span>
                <span className="text-xs text-white/50 uppercase tracking-wide">Amount</span>
              </div>
            </div>

            {/* Swap Arrow */}
            <div className="relative h-2 w-full flex justify-center z-20 -mt-2 mb-2">
              <div className="absolute -top-5 p-3 bg-[#1B1B1B] border-[5px] border-[#131313] rounded-2xl shadow-lg">
                <ArrowDown size={24} strokeWidth={3} />
              </div>
            </div>

            {/* To Token (Buy) */}
            <div className="bg-[#131313]/50 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between mt-3">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden">
                  {tokenOut?.logoURI ? (
                    <img
                      src={tokenOut.logoURI}
                      alt={tokenOut.symbol}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-primary/20" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white">{tokenOut?.symbol}</span>
                  {tokenOut?.name && (
                    <span className="text-xs text-white/50 truncate max-w-[120px]">
                      {tokenOut.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-emerald-500 tabular-nums block">
                  {minAmountOut}
                </span>
                <span className="text-xs text-emerald-400/70 uppercase tracking-wide">
                  Guaranteed
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="bg-[#131313]/50 backdrop-blur-sm border border-white/[0.05] rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40 block">
              Details
            </span>
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <div className="flex justify-between items-center text-xs py-0.5">
                <span className="text-white/60">Fee</span>
                <span className="text-white/80 font-medium">Free</span>
              </div>

              {gasCostUsd !== null && (
                <div className="flex justify-between items-center text-xs py-0.5">
                  <span className="text-white/60">Network cost</span>
                  <span className="text-white/80 font-medium">${gasCostUsd.toFixed(2)}</span>
                </div>
              )}

              {!isWrapUnwrap && (
                <>
                  <div className="flex justify-between items-center text-xs py-0.5">
                    <span className="text-white/60">Max slippage</span>
                    <span className="text-white/80 font-medium">{slippage}%</span>
                  </div>

                  <div className="flex justify-between items-center text-xs py-0.5">
                    <span className="text-white/60">Order routing</span>
                    <span className="text-white/80 font-medium">Fast Protocol</span>
                  </div>

                  <div className="flex justify-between items-center text-xs py-0.5">
                    <span className="text-white/60">Price impact</span>
                    <span
                      className={cn(
                        "font-medium",
                        priceImpactSeverity === "low" && "text-green-400",
                        priceImpactSeverity === "medium" && "text-yellow-400",
                        priceImpactSeverity === "high" && "text-red-400"
                      )}
                    >
                      {formatPriceImpact(priceImpact)}
                    </span>
                  </div>
                </>
              )}

              {isWrapUnwrap && (
                <div className="flex justify-between items-center text-xs py-0.5">
                  <span className="text-white/60">Exchange rate</span>
                  <span className="text-white/80 font-medium">1:1</span>
                </div>
              )}
            </div>
          </div>

          {/* High Price Impact Warning - Hide for wrap/unwrap */}
          {hasHighPriceImpact && !isWrapUnwrap && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 animate-pulse">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">
                    High Price Impact
                  </p>
                  <p className="text-[11px] font-medium text-red-400 leading-tight">
                    This swap has {formatPriceImpact(priceImpact)} price impact. Consider reducing
                    the amount.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "w-full h-12 bg-primary text-primary-foreground font-bold uppercase tracking-[0.15em] text-sm rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
                isLoading
                  ? "bg-[#1B1B1B] text-white/40 cursor-not-allowed border border-white/5"
                  : "hover:bg-primary/90 cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-[1.01]"
              )}
            >
              {buttonText}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-3 text-xs font-bold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors rounded-lg hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default React.memo(SwapConfirmationModal)
