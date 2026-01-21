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
    const currentSellValue =
      editingSide === "sell" ? amount : displayQuote || quote?.amountInFormatted || ""
    const currentBuyValue =
      editingSide === "buy" ? amount : displayQuote || quote?.amountOutFormatted || ""

    const tempFromToken = fromToken
    const tempToToken = toToken

    let hasExplicitlyClearedFromToken = false
    let hasExplicitlyClearedToToken = false

    if (tempToToken === undefined) {
      hasExplicitlyClearedFromToken = true
    }

    if (tempFromToken === undefined) {
      hasExplicitlyClearedToToken = true
    }

    if (editingSide === "sell") {
      onSwitch({
        newFromToken: tempToToken,
        newToToken: tempFromToken,
        newAmount: currentSellValue || "",
        newDisplayQuote: currentBuyValue || "",
        newEditingSide: "buy",
        hasExplicitlyClearedFromToken,
        hasExplicitlyClearedToToken,
      })
    } else {
      onSwitch({
        newFromToken: tempToToken,
        newToToken: tempFromToken,
        newAmount: currentBuyValue || "",
        newDisplayQuote: currentSellValue || "",
        newEditingSide: "sell",
        hasExplicitlyClearedFromToken,
        hasExplicitlyClearedToToken,
      })
    }
  }, [fromToken, toToken, amount, displayQuote, editingSide, quote, onSwitch])

  return { handleSwitch }
}
