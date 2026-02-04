"use client"

import React, { useMemo } from "react"
import NumberFlow from "@number-flow/react"
// UI Components & Icons
import { AlertTriangle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radix-ui/react-tooltip"

// Utils & Hooks
import { cn } from "@/lib/utils"
import { QuoteResult, getPriceImpactSeverity, formatPriceImpact } from "@/hooks/use-swap-quote"

/**
 * Isolated countdown badge - only this re-renders when timeLeft updates (every second),
 * not the entire ExchangeRate. Reduces TBT.
 */
const TimeLeftBadge = React.memo(function TimeLeftBadge({
  timeLeft,
  show,
  isManualInversion,
}: {
  timeLeft: number
  show: boolean
  isManualInversion: boolean
}) {
  if (!show) return null
  return (
    <div className="flex items-center gap-1.5 ml-1 bg-white/5 px-1.5 py-0.5 rounded-md">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full transition-colors duration-500",
          isManualInversion ? "bg-yellow-500 animate-pulse" : "bg-primary"
        )}
      />
      <span className="text-[10px] tabular-nums font-bold opacity-80">{timeLeft}s</span>
    </div>
  )
})

/**
 * Prop interface focused on essential quote data.
 * Internalized the severity calculation to reduce parent complexity.
 */
interface ExchangeRateProps {
  // The pre-formatted string or element showing "1 ABC = 0.5 XYZ" (fallback when no numeric rate)
  exchangeRateContent: React.ReactNode

  // Numeric rate for NumberFlow (subtle animation on refetch; no "Fetching rate..." text)
  exchangeRateValue: number | null
  exchangeRateFromSymbol: string
  exchangeRateToSymbol: string
  exchangeRateToStable: boolean
  isQuoteLoading?: boolean

  // The raw quote data from the API
  activeQuote: QuoteResult | null

  // Logical flags to determine UI behavior
  isWrapUnwrap: boolean
  isManualInversion: boolean

  // The countdown until the current quote expires
  timeLeft: number
}

const ExchangeRateComponent: React.FC<ExchangeRateProps> = ({
  exchangeRateContent,
  exchangeRateValue,
  exchangeRateFromSymbol,
  exchangeRateToSymbol,
  exchangeRateToStable,
  isQuoteLoading = false,
  activeQuote,
  isWrapUnwrap,
  isManualInversion,
  timeLeft,
}) => {
  /**
   * 1. DERIVED LOCAL STATE
   * We use useMemo here to ensure that severity calculations only
   * run when the actual quote data changes, keeping the component performant.
   */
  const { priceImpact, severity, formattedImpact } = useMemo(() => {
    // If we are in manual inversion, we usually want to hide or freeze the impact
    // because the impact of an inverted quote isn't 100% accurate until re-fetched.
    if (isManualInversion && !activeQuote) {
      return {
        priceImpact: 0,
        severity: "low" as const,
        formattedImpact: "...", // Shows a placeholder while switching
      }
    }

    const impact = activeQuote?.priceImpact ?? 0
    return {
      priceImpact: impact,
      severity: getPriceImpactSeverity(impact),
      formattedImpact: activeQuote ? formatPriceImpact(impact) : "-",
    }
  }, [activeQuote, isManualInversion])

  /**
   * 2. CONDITIONAL RENDER CHECK
   * If we are performing a 1:1 wrap/unwrap, the price impact logic is
   * irrelevant. We return a simplified view or handle the exclusion internally.
   */
  const showExtendedInfo = activeQuote && !isWrapUnwrap

  return (
    <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl bg-white/5 border border-white/5 px-3 py-2 sm:px-4 sm:py-3 transition-all duration-300 ease-in-out">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {/* LEFT SECTION: EXCHANGE RATE & LIVE STATUS */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-gray-400 font-medium inline-flex items-center gap-1",
              isQuoteLoading && "opacity-80"
            )}
          >
            {exchangeRateValue != null ? (
              <>
                1 {exchangeRateFromSymbol} ={" "}
                <NumberFlow
                  value={exchangeRateValue}
                  format={{
                    minimumFractionDigits: exchangeRateToStable ? 2 : 0,
                    maximumFractionDigits: exchangeRateToStable ? 2 : 6,
                  }}
                  style={
                    {
                      "--number-flow-char-gap": "-0.5px",
                      "--number-flow-mask-duration": "0.3s",
                      "--number-flow-mask-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
                      fontVariantNumeric: "tabular-nums",
                    } as React.CSSProperties
                  }
                />{" "}
                {exchangeRateToSymbol}
              </>
            ) : (
              exchangeRateContent
            )}
          </span>

          {/* STATUS INDICATOR: Isolated so only countdown re-renders every second */}
          <TimeLeftBadge
            timeLeft={timeLeft}
            show={showExtendedInfo}
            isManualInversion={isManualInversion}
          />
        </div>

        {/* RIGHT SECTION: PRICE IMPACT */}
        {!isWrapUnwrap && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Impact:</span>
            <span
              className={cn(
                "font-semibold transition-colors",
                severity === "low" && "text-emerald-400",
                severity === "medium" && "text-amber-400",
                severity === "high" && "text-red-400"
              )}
            >
              {formattedImpact}
            </span>

            {severity === "medium" && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center focus:outline-none" type="button">
                      <AlertTriangle className="h-3 w-3 text-amber-400 ml-0.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="z-[60] bg-[#1c2128] border border-white/10 px-3 py-2 text-xs text-white rounded-lg shadow-xl max-w-[200px]"
                  >
                    <p className="font-semibold text-amber-400 mb-1">Medium Price Impact</p>
                    This trade may move the market price. Consider a smaller amount.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {severity === "high" && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center focus:outline-none" type="button">
                      <AlertTriangle className="h-3 w-3 text-red-400 ml-0.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="z-[60] bg-[#1c2128] border border-white/10 px-3 py-2 text-xs text-white rounded-lg shadow-xl max-w-[200px]"
                  >
                    <p className="font-semibold text-red-400 mb-1">High Price Impact</p>
                    This trade will significantly move the market price. You may receive less than
                    expected.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const ExchangeRate = React.memo(ExchangeRateComponent)
