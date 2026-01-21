"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency } from "@/lib/utils"
import { formatPriceImpact, getPriceImpactSeverity } from "@/hooks/use-quote"
import { AlertTriangle, ArrowDown } from "lucide-react"
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
  isLoading?: boolean
}

export default function SwapConfirmationModal({
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
  isLoading = false,
}: SwapConfirmationModalProps) {
  const priceImpactSeverity = getPriceImpactSeverity(priceImpact)
  const hasHighPriceImpact = Math.abs(priceImpact) > 3

  // Format gas estimate (rough conversion, 1 ETH = ~$3000 for display)
  const gasEstimateEth = gasEstimate ? (Number(gasEstimate) / 1e18).toFixed(6) : "—"
  const gasEstimateUsd = gasEstimate
    ? `~$${(Number(gasEstimate) / 1e18) * 3000}` // Rough estimate
    : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-[#131313] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">Review Swap</DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            Please review the details of your swap before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Swap Amounts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#1B1B1B] border border-white/10">
              <div className="flex items-center gap-2">
                {tokenIn?.logoURI && (
                  <img
                    src={tokenIn.logoURI}
                    alt={tokenIn.symbol}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-sm font-medium text-white">{tokenIn?.symbol || "—"}</span>
              </div>
              <span className="text-lg font-semibold text-white">{amountIn || "0"}</span>
            </div>

            <div className="flex justify-center -my-2">
              <div className="p-2 bg-[#1B1B1B] border border-white/10 rounded-full">
                <ArrowDown size={16} className="text-white/60" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#1B1B1B] border border-white/10">
              <div className="flex items-center gap-2">
                {tokenOut?.logoURI && (
                  <img
                    src={tokenOut.logoURI}
                    alt={tokenOut.symbol}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-sm font-medium text-white">{tokenOut?.symbol || "—"}</span>
              </div>
              <span className="text-lg font-semibold text-white">{amountOut || "0"}</span>
            </div>
          </div>

          {/* Swap Details */}
          <div className="space-y-2 p-4 rounded-xl bg-[#1B1B1B] border border-white/10">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/60">Rate</span>
              <span className="text-white font-medium">
                1 {tokenIn?.symbol} = {exchangeRate.toFixed(6)} {tokenOut?.symbol}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-white/60">Price Impact</span>
              <span
                className={cn(
                  "font-medium",
                  priceImpactSeverity === "low" && "text-green-500",
                  priceImpactSeverity === "medium" && "text-yellow-500",
                  priceImpactSeverity === "high" && "text-red-500"
                )}
              >
                {formatPriceImpact(priceImpact)}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-white/60">Minimum Received</span>
              <span className="text-white font-medium">
                {minAmountOut} {tokenOut?.symbol}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-white/60">Slippage Tolerance</span>
              <span className="text-white font-medium">{slippage}%</span>
            </div>

            {gasEstimate && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/60">Estimated Gas</span>
                <span className="text-white font-medium">
                  {gasEstimateEth} ETH ({gasEstimateUsd})
                </span>
              </div>
            )}
          </div>

          {/* Price Impact Warning */}
          {hasHighPriceImpact && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-yellow-500">High Price Impact</p>
                <p className="text-xs text-yellow-500/80 mt-1">
                  This swap has a price impact of {formatPriceImpact(priceImpact)}. You may receive
                  significantly less than expected.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-[#1B1B1B] border-white/10 text-white hover:bg-[#222]"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? "Confirming..." : "Confirm Swap"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
