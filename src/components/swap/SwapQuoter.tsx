"use client"

import { useState, useEffect } from "react"
import { Timer, RefreshCw, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useQuote,
  formatQuoteAmount,
  formatPriceImpact,
  getPriceImpactSeverity,
} from "@/hooks/use-quote"

const QUOTE_TTL = 15 // Seconds a quote is valid

interface SwapQuoterProps {
  tokenIn: string
  tokenOut: string
  amountIn: string
  slippage?: string // e.g., "0.5" for 0.5%, defaults to "0.5"
  enabled?: boolean
}

export default function SwapQuoter({
  tokenIn,
  tokenOut,
  amountIn,
  slippage = "0.5",
  enabled = true,
}: SwapQuoterProps) {
  const { quote, isLoading, error, refetch } = useQuote({
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    enabled: enabled && !!tokenIn && !!tokenOut && !!amountIn && parseFloat(amountIn) > 0,
  })

  const [timeLeft, setTimeLeft] = useState(QUOTE_TTL)

  // Handle countdown timer
  useEffect(() => {
    if (!quote) {
      setTimeLeft(QUOTE_TTL)
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          refetch() // Auto-refresh when timer hits 0
          return QUOTE_TTL
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [quote, refetch])

  // Reset timer when quote changes
  useEffect(() => {
    if (quote) {
      setTimeLeft(QUOTE_TTL)
    }
  }, [quote])

  const priceImpactSeverity = quote ? getPriceImpactSeverity(quote.priceImpact) : "low"

  return (
    <div className="space-y-1.5 text-xs">
      {error ? (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive py-1.5">
          <AlertCircle size={10} />
          <span>Error fetching quote</span>
        </div>
      ) : quote ? (
        <>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">Expected Output</span>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {formatQuoteAmount(quote.amountOutFormatted)} {tokenOut}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">Price</span>
            <span className="text-[11px] text-foreground/70 tabular-nums">
              1 {tokenIn} = {quote.exchangeRate.toFixed(6)} {tokenOut}
            </span>
          </div>
          {quote.priceImpact < -0.01 && (
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Price Impact</span>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  priceImpactSeverity === "high"
                    ? "text-destructive"
                    : priceImpactSeverity === "medium"
                      ? "text-yellow-500"
                      : "text-foreground/70"
                )}
              >
                {formatPriceImpact(quote.priceImpact)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1.5 border-t border-border/20">
            <span className="text-[11px] text-muted-foreground">Minimum Received</span>
            <span className="text-[11px] text-foreground/60 tabular-nums">
              {formatQuoteAmount(quote.minOutFormatted)} {tokenOut}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[11px] text-muted-foreground">Quote expires in</span>
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-mono",
                timeLeft < 5 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <Timer size={10} className={cn(timeLeft < 5 && "text-destructive animate-pulse")} />
              <span className="tabular-nums">{timeLeft}s</span>
            </div>
          </div>
        </>
      ) : (
        <div className="py-1.5 text-center">
          <span className="text-[11px] text-muted-foreground">
            {amountIn && parseFloat(amountIn) > 0
              ? "Fetching quote..."
              : "Enter an amount to see a quote..."}
          </span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1.5 border-t border-border/20">
          <RefreshCw size={10} className="animate-spin" />
          <span>Updating...</span>
        </div>
      )}
    </div>
  )
}
