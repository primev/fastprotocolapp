"use client"

import React, { useMemo } from "react"
import NumberFlow, { type Format } from "@number-flow/react"
import { Info } from "lucide-react"
// Utils & Hooks
import { cn } from "@/lib/utils"
import { QuoteResult, getPriceImpactSeverity, formatPriceImpact } from "@/hooks/use-swap-quote"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

  // Estimated miles from this swap
  estimatedMiles?: number | null
  /** True when Barter validated the swap as too small to clear at the current
   *  slippage. Drives the no-miles slot to a plain dash since the swap itself
   *  is in an error state and a "why" tooltip would compete with the error. */
  barterAmountTooSmall?: boolean
  /** Opens the miles calculator. Used by the "apply manually" affordance
   *  shown when miles aren't available at the current swap size by default
   *  but could be reachable via custom slippage. */
  onOpenCalculator?: () => void
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
  estimatedMiles,
  barterAmountTooSmall = false,
  onOpenCalculator,
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

  // Pick format options by rate magnitude so tiny rates (e.g. 1 USDC = 0.00001 WBTC)
  // render with significant digits instead of rounding to 0.
  const rateFormat = useMemo<Format>(() => {
    if (exchangeRateToStable) return { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    if (exchangeRateValue == null) return { maximumFractionDigits: 4 }
    const abs = Math.abs(exchangeRateValue)
    if (abs >= 1) return { maximumFractionDigits: 4 }
    if (abs >= 0.001) return { maximumFractionDigits: 6 }
    return { maximumSignificantDigits: 6 }
  }, [exchangeRateToStable, exchangeRateValue])

  return (
    <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl bg-white/5 border border-white/5 px-3 py-2 sm:px-4 sm:py-3 transition-all duration-300 ease-in-out">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 text-xs text-muted-foreground">
        {/* LEFT SECTION: EXCHANGE RATE & LIVE STATUS */}
        <div className="flex items-center justify-between sm:justify-start gap-2 whitespace-nowrap">
          <span
            className={cn(
              "text-gray-400 font-medium inline-flex items-center gap-1 whitespace-nowrap",
              isQuoteLoading && "opacity-80"
            )}
          >
            {exchangeRateValue != null ? (
              <>
                1 {exchangeRateFromSymbol} ={" "}
                <NumberFlow
                  value={exchangeRateValue}
                  format={rateFormat}
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

        {/* RIGHT SECTION: MILES ESTIMATE / PRICE IMPACT */}
        {!isWrapUnwrap && (
          <div className="flex items-center justify-between sm:justify-start gap-2 whitespace-nowrap">
            {estimatedMiles != null && (
              <div className="flex items-center gap-1.5">
                {estimatedMiles > 0 ? (
                  <>
                    <div className="relative flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#3898FF] animate-pulse" />
                      <div className="absolute h-1.5 w-1.5 rounded-full bg-[#3898FF] animate-ping opacity-75" />
                    </div>
                    <span className="font-semibold text-[#3898FF] whitespace-nowrap">
                      ~{estimatedMiles.toLocaleString("en-US")} miles
                    </span>
                  </>
                ) : barterAmountTooSmall ? (
                  // Swap itself is in an error state — barter rejected the size.
                  // The action button surfaces that; here a single dash keeps the
                  // slot occupied without competing for attention.
                  <span className="text-gray-500" aria-label="No miles estimate">
                    —
                  </span>
                ) : (
                  // Estimator returned 0 — gas/bid costs at this swap size
                  // consume the entire default surplus, so miles aren't
                  // available at auto slippage. Render the inline label as
                  // a button: clicking opens the calc so the user can apply
                  // a higher slippage manually and target some miles.
                  // Hover surfaces the why + Learn link.
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onOpenCalculator?.()}
                          className="inline-flex items-center gap-1 text-[#3898FF]/80 hover:text-[#3898FF] transition cursor-pointer"
                        >
                          Apply Miles
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-xs">
                        <div className="flex flex-col gap-2">
                          <span>
                            Miles are not available by default at this swap size — open the
                            calculator to apply manually.
                          </span>
                          <div className="flex justify-end">
                            <a
                              href="/learn/miles#about-the-miles-estimate"
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-[#3898FF]/40 px-2 py-0.5 text-[11px] font-medium text-[#3898FF] transition hover:border-[#3898FF] hover:bg-[#3898FF]/10"
                            >
                              Learn
                            </a>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}

            {activeQuote && (
              <span className="text-gray-400 font-medium">(Impact: {formattedImpact})</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const ExchangeRate = React.memo(ExchangeRateComponent)
