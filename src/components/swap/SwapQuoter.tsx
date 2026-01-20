"use client"

import { useState, useEffect, useRef } from "react"
import { Timer, RefreshCw, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useQuote,
  formatQuoteAmount,
  formatPriceImpact,
  getPriceImpactSeverity,
  type QuoteResult,
} from "@/hooks/use-quote"

const QUOTE_TTL = 15 // Seconds a quote is valid
const REFETCH_THRESHOLD = 3 // Refetch when 3 seconds remain

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
  const [displayQuote, setDisplayQuote] = useState<QuoteResult | null>(null)
  const hasRefetchedRef = useRef(false)
  const lastQuoteIdRef = useRef<string | null>(null)

  // Generate a unique ID for a quote based on its values
  const getQuoteId = (q: QuoteResult) => `${q.amountOut.toString()}-${q.exchangeRate}-${q.fee}`

  // Keep the previous quote visible while fetching a new one
  // Only update displayQuote when we get a genuinely new quote
  useEffect(() => {
    if (quote) {
      const quoteId = getQuoteId(quote)
      // Only update if it's a new quote (different ID)
      if (quoteId !== lastQuoteIdRef.current) {
        setDisplayQuote(quote)
        lastQuoteIdRef.current = quoteId
        hasRefetchedRef.current = false
        setTimeLeft(QUOTE_TTL)
      }
    }
    // Don't clear displayQuote when quote becomes null - keep showing the last valid quote
    // Only clear if we explicitly don't have tokens/amount
  }, [quote])

  // Clear displayQuote only when inputs are invalid (no tokens or amount)
  useEffect(() => {
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      setDisplayQuote(null)
      lastQuoteIdRef.current = null
      hasRefetchedRef.current = false
    }
  }, [tokenIn, tokenOut, amountIn])

  // Handle countdown timer and auto-refetch
  useEffect(() => {
    if (!displayQuote) {
      setTimeLeft(QUOTE_TTL)
      hasRefetchedRef.current = false
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1

        // Refetch when we hit the threshold (only once per quote)
        if (newTime === REFETCH_THRESHOLD && !hasRefetchedRef.current) {
          hasRefetchedRef.current = true
          refetch() // Fetch new quote before expiration
        }

        // If timer reaches 0, reset it and try refetching again if needed
        if (newTime <= 0) {
          const currentQuoteId = quote ? getQuoteId(quote) : null
          // If we still have the same quote, refetch again
          if (!currentQuoteId || currentQuoteId === lastQuoteIdRef.current) {
            refetch()
          }
          return QUOTE_TTL
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [displayQuote, refetch, quote])

  // Use displayQuote for rendering to ensure we always show a value when tokens are present
  // displayQuote persists even when quote is temporarily null during refetch
  const activeQuote = displayQuote || quote
  const priceImpactSeverity = activeQuote ? getPriceImpactSeverity(activeQuote.priceImpact) : "low"
  const isExpiringSoon = activeQuote && timeLeft <= REFETCH_THRESHOLD

  // Only show error if we don't have any quote to display
  const showError = error && !activeQuote

  return (
    <div className="space-y-1.5 text-xs">
      {showError ? (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive py-1.5">
          <AlertCircle size={10} />
          <span>Error fetching quote</span>
        </div>
      ) : activeQuote ? (
        <>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">Expected Output</span>
            <span
              className={cn(
                "text-xs font-medium text-foreground tabular-nums",
                isExpiringSoon && "animate-pulse text-yellow-400"
              )}
            >
              {formatQuoteAmount(activeQuote.amountOutFormatted)} {tokenOut}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">Price</span>
            <span
              className={cn(
                "text-[11px] text-foreground/70 tabular-nums",
                isExpiringSoon && "animate-pulse text-yellow-400/70"
              )}
            >
              1 {tokenIn} = {activeQuote.exchangeRate.toFixed(6)} {tokenOut}
            </span>
          </div>
          {activeQuote.priceImpact < -0.01 && (
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
                {formatPriceImpact(activeQuote.priceImpact)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1.5 border-t border-border/20">
            <span className="text-[11px] text-muted-foreground">Minimum Received</span>
            <span
              className={cn(
                "text-[11px] text-foreground/60 tabular-nums",
                isExpiringSoon && "animate-pulse text-yellow-400/60"
              )}
            >
              {formatQuoteAmount(activeQuote.minOutFormatted)} {tokenOut}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[11px] text-muted-foreground">Quote expires in</span>
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-mono",
                isExpiringSoon ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <Timer size={10} className={cn(isExpiringSoon && "text-destructive animate-pulse")} />
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

      {isLoading && activeQuote && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1.5 border-t border-border/20">
          <RefreshCw size={10} className="animate-spin" />
          <span>Updating...</span>
        </div>
      )}
    </div>
  )
}
