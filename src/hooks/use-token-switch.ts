"use client"

import { useCallback } from "react"
import type { Token } from "@/types/swap"

interface UseTokenSwitchParams {
  fromToken: Token | undefined
  toToken: Token | undefined
  amount: string
  displayQuote: string | null
  editingSide: "sell" | "buy"
  quote: {
    amountInFormatted?: string
    amountOutFormatted?: string
  } | null
  onSwitch: (params: {
    newFromToken: Token | undefined
    newToToken: Token | undefined
    newAmount: string
    newDisplayQuote: string
    newEditingSide: "sell" | "buy"
    hasExplicitlyClearedFromToken: boolean
    hasExplicitlyClearedToToken: boolean
  }) => void
}

/**
 * Hook for handling token switch logic following Uniswap patterns
 * Properly swaps tokens and amounts while maintaining state consistency
 */
export function useTokenSwitch({
  fromToken,
  toToken,
  amount,
  displayQuote,
  editingSide,
  quote,
  onSwitch,
}: UseTokenSwitchParams) {
  const handleSwitch = useCallback(() => {
    // Capture the actual displayed values from both sides
    // Active side shows the amount being edited
    // Inactive side shows the calculated quote
    const sellDisplayed =
      editingSide === "sell"
        ? amount // Sell side is active, shows amount
        : displayQuote || quote?.amountInFormatted || null // Sell side is inactive, shows quote

    const buyDisplayed =
      editingSide === "buy"
        ? amount // Buy side is active, shows amount
        : displayQuote || quote?.amountOutFormatted || null // Buy side is inactive, shows quote

    // Swap token references
    const newFromToken = toToken
    const newToToken = fromToken

    // Track if tokens were explicitly cleared (for proper state management)
    const hasExplicitlyClearedFromToken = newFromToken === undefined
    const hasExplicitlyClearedToToken = newToToken === undefined

    // Determine new editing side (opposite of current)
    const newEditingSide: "sell" | "buy" = editingSide === "sell" ? "buy" : "sell"

    // Following Uniswap's pattern:
    // - The value from the currently active side becomes the new amount (for the new active side)
    // - The value from the currently inactive side becomes the display quote (for the new inactive side)
    // IMPORTANT: Always use the active side's amount, never use "0" from inactive side
    if (editingSide === "sell") {
      // Switching from sell to buy:
      // - Buy becomes active, so it gets the old sell value (amount)
      // - Sell becomes inactive, so it gets the old buy value (quote)
      onSwitch({
        newFromToken,
        newToToken,
        newAmount: amount || "", // Always use the active side's amount (sell side)
        newDisplayQuote: buyDisplayed || "", // Old buy value → new sell (inactive)
        newEditingSide,
        hasExplicitlyClearedFromToken,
        hasExplicitlyClearedToToken,
      })
    } else {
      // Switching from buy to sell:
      // - Sell becomes active, so it gets the old buy value (amount)
      // - Buy becomes inactive, so it gets the old sell value (quote)
      onSwitch({
        newFromToken,
        newToToken,
        newAmount: amount || "", // Always use the active side's amount (buy side)
        newDisplayQuote: sellDisplayed || "", // Old sell value → new buy (inactive)
        newEditingSide,
        hasExplicitlyClearedFromToken,
        hasExplicitlyClearedToToken,
      })
    }
  }, [fromToken, toToken, amount, displayQuote, editingSide, quote, onSwitch])

  return { handleSwitch }
}
