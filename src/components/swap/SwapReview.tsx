"use client"

import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPriceImpact, getPriceImpactSeverity } from "@/hooks/use-quote"
import { useGasPrice } from "@/hooks/use-gas-price"
import type { Token } from "@/types/swap"
import type { QuoteResult } from "@/hooks/use-quote"

interface SwapReviewProps {
  fromToken: Token
  toToken: Token
  quote: QuoteResult
  exchangeRate: number
  minAmountOut: string
  slippage: string
  ethPrice: number | null
  timeLeft: number
  displayQuote: string | null
  hasHighPriceImpact: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSettingsOpen: () => void
  onTokenSwap: () => void
}

export default function SwapReview({
  fromToken,
  toToken,
  quote,
  exchangeRate,
  minAmountOut,
  slippage,
  ethPrice,
  timeLeft,
  displayQuote,
  hasHighPriceImpact,
  isOpen,
  onOpenChange,
  onSettingsOpen,
  onTokenSwap,
}: SwapReviewProps) {
  const priceImpactSeverity = getPriceImpactSeverity(quote.priceImpact)
  const { gasPrice } = useGasPrice()

  // Calculate gas cost in USD: (gasEstimate * gasPrice) / 1e18 * ethPrice
  const gasCostUsd =
    quote.gasEstimate && gasPrice && ethPrice
      ? (Number(quote.gasEstimate) * Number(gasPrice) * ethPrice) / 1e18
      : null

  return (
    <div className="px-4 py-2 border-t border-white/5 mt-1">
      {/* HEADER: Exchange rate, Show less */}
      {exchangeRate > 0 && (
        <div className="w-full flex justify-between items-center text-xs py-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTokenSwap()
            }}
            className="text-white/80 hover:text-white transition-colors cursor-pointer font-medium"
          >
            1 {fromToken.symbol} = {exchangeRate.toFixed(6)} {toToken.symbol}
          </button>
          <button
            onClick={() => onOpenChange(!isOpen)}
            className="text-white/60 hover:text-white/80 transition-colors flex items-center gap-1"
          >
            <span className="text-xs">Show {isOpen ? "less" : "more"}</span>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      )}

      {/* ACCORDION CONTENT */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isOpen ? "max-h-[500px] opacity-100 scale-100" : "max-h-0 opacity-0 scale-[0.98]"
        )}
      >
        <div className="space-y-1.5 mt-2 pt-2 border-t border-white/5">
          {/* Fee */}
          <div className="flex justify-between items-center text-xs py-0.5">
            <span className="text-white/60">Fee</span>
            <span className="text-white/80 font-medium">Free</span>
          </div>

          {/* Network cost */}
          {gasCostUsd !== null && (
            <div className="flex justify-between items-center text-xs py-0.5">
              <span className="text-white/60">Network cost</span>
              <span className="text-white/80 font-medium">${gasCostUsd.toFixed(2)}</span>
            </div>
          )}

          {/* Max slippage */}
          <div className="flex justify-between items-center text-xs py-0.5">
            <span className="text-white/60">Max slippage</span>
            <button
              onClick={onSettingsOpen}
              className="text-white/80 font-medium underline decoration-dotted decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white/60 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Auto</span>
              <span>{slippage}%</span>
            </button>
          </div>

          {/* Order routing */}
          <div className="flex justify-between items-center text-xs py-0.5">
            <span className="text-white/60">Order routing</span>
            <span className="text-white/80 font-medium">Fast Protocol</span>
          </div>

          {/* Price Impact */}
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
              {formatPriceImpact(quote.priceImpact)}
            </span>
          </div>

          {/* Minimum received */}
          <div className="flex justify-between items-center text-xs py-0.5">
            <span className="text-white/60">Minimum received</span>
            <span className="text-white/80 font-medium">
              {minAmountOut} {toToken.symbol}
            </span>
          </div>

          {/* Quote Refresh */}
          {displayQuote && timeLeft > 0 && (
            <>
              <div className="border-t border-white/5 my-1" />
              <div className="flex justify-between items-center text-xs py-0.5">
                <span className="text-white/60">Quote Refresh</span>
                <span
                  className={cn("font-medium", timeLeft <= 5 ? "text-yellow-400" : "text-white/80")}
                >
                  {timeLeft}s
                </span>
              </div>
            </>
          )}

          {hasHighPriceImpact && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mt-2">
              <AlertTriangle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-400 leading-relaxed">
                High price impact. You may receive significantly less than expected.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
