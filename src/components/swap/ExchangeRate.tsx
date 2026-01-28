"use client"

import React, { useMemo } from "react"
// UI Components & Icons
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radix-ui/react-tooltip"

// Utils & Hooks
import { cn } from "@/lib/utils"
import { QuoteResult, getPriceImpactSeverity, formatPriceImpact } from "@/hooks/use-swap-quote"

/**
 * Prop interface focused on essential quote data.
 * Internalized the severity calculation to reduce parent complexity.
 */
interface ExchangeRateProps {
  // The pre-formatted string or element showing "1 ABC = 0.5 XYZ"
  exchangeRateContent: React.ReactNode

  // The raw quote data from the API
  activeQuote: QuoteResult | null

  // Logical flags to determine UI behavior
  isWrapUnwrap: boolean
  isManualInversion: boolean

  // The countdown until the current quote expires
  timeLeft: number
}

export const ExchangeRate: React.FC<ExchangeRateProps> = ({
  exchangeRateContent,
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
          <span className="text-gray-400 font-medium">{exchangeRateContent}</span>

          {/* STATUS INDICATOR:
              A pulsing dot indicates the quote is 'live'. 
              We switch to yellow if 'isManualInversion' is true, signaling 
              to the user they are looking at a flipped rate view.
          */}
          {showExtendedInfo && (
            <div className="flex items-center gap-1.5 ml-1 bg-white/5 px-1.5 py-0.5 rounded-md">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors duration-500",
                  isManualInversion ? "bg-yellow-500 animate-pulse" : "bg-primary"
                )}
              />
              <span className="text-[10px] tabular-nums font-bold opacity-80">{timeLeft}s</span>
            </div>
          )}
        </div>

        {/* RIGHT SECTION: PRICE IMPACT */}
        {!isWrapUnwrap && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Impact:</span>
            <span
              className={cn(
                "font-semibold transition-colors",
                severity === "low" && "text-green-400",
                severity === "medium" && "text-yellow-400",
                severity === "high" && "text-red-400"
              )}
            >
              {formattedImpact}
            </span>

            {/* HIGH IMPACT WARNING TOOLTIP:
                Only rendered if the impact reaches a dangerous threshold.
            */}
            {severity === "high" && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center focus:outline-none">
                      <Info className="h-3 w-3 text-red-400 ml-0.5 animate-pulse" />
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
