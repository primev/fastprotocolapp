"use client"

import { useState, useEffect } from "react"

const DEFAULT_DIVERGENCE_THRESHOLD_PCT = 25
const DEFAULT_TREASURY_MARGIN_PCT = 1.5

export interface QuoteGuardConfig {
  /** Fallback triggers when Barter output exceeds Uniswap output by more than this percentage. */
  divergenceThresholdPct: number
  /** When the fallback triggers, minAmountOut = barterOutput * (1 - treasuryMarginPct/100). */
  treasuryMarginPct: number
}

/**
 * Fetches the quote-guard configuration from Edge Config.
 * Falls back to built-in defaults until the request completes or on failure.
 */
export function useQuoteGuardConfig(): QuoteGuardConfig {
  const [config, setConfig] = useState<QuoteGuardConfig>({
    divergenceThresholdPct: DEFAULT_DIVERGENCE_THRESHOLD_PCT,
    treasuryMarginPct: DEFAULT_TREASURY_MARGIN_PCT,
  })

  useEffect(() => {
    let cancelled = false

    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config/quote-guard")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setConfig({
          divergenceThresholdPct:
            typeof data.divergenceThresholdPct === "number" && data.divergenceThresholdPct > 0
              ? data.divergenceThresholdPct
              : DEFAULT_DIVERGENCE_THRESHOLD_PCT,
          treasuryMarginPct:
            typeof data.treasuryMarginPct === "number" && data.treasuryMarginPct >= 0
              ? data.treasuryMarginPct
              : DEFAULT_TREASURY_MARGIN_PCT,
        })
      } catch {
        // defaults already set
      }
    }

    fetchConfig()
    return () => {
      cancelled = true
    }
  }, [])

  return config
}
