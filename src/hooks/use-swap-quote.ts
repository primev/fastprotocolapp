"use client"

import { useState, useEffect, useCallback } from "react"
import type { Token } from "@/types/swap"

const QUOTE_TTL = 15 // Seconds a quote is valid

export interface Quote {
  output: string
  price: string
  fee: string
}

interface UseSwapQuoteProps {
  tokenIn: Token | undefined
  tokenOut: Token | undefined
  amountIn: string
}

export function useSwapQuote({ tokenIn, tokenOut, amountIn }: UseSwapQuoteProps) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [timeLeft, setTimeLeft] = useState(QUOTE_TTL)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // SIMULATED CUSTOM LOGIC ENGINE
  // In your real app, this will call your backend or Uniswap v4 Quoter
  const fetchQuote = useCallback(async () => {
    if (!amountIn || amountIn === "0" || !tokenIn || !tokenOut) {
      setQuote(null)
      return
    }

    setIsRefreshing(true)

    // Simulate network delay
    await new Promise((res) => setTimeout(res, 800))

    // Dummy pricing logic: TokenOut = TokenIn * (Random Market Price)
    const mockPrice = 2500.45 + (Math.random() * 10 - 5)
    const mockOutput = parseFloat(amountIn) * mockPrice

    setQuote({
      output: mockOutput.toFixed(6),
      price: mockPrice.toFixed(2),
      fee: (mockOutput * 0.003).toFixed(6), // 0.3% fee
    })

    setIsRefreshing(false)
    setTimeLeft(QUOTE_TTL) // Reset timer after new quote
  }, [amountIn, tokenIn, tokenOut])

  // Handle the Countdown Timer
  useEffect(() => {
    if (!quote) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchQuote() // Auto-refresh when timer hits 0
          return QUOTE_TTL
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [quote, fetchQuote])

  // Initial fetch when amount changes
  useEffect(() => {
    fetchQuote()
  }, [fetchQuote])

  return {
    quote,
    timeLeft,
    isRefreshing,
  }
}
