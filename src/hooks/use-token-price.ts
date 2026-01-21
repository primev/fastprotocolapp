"use client"

import { useState, useEffect, useCallback } from "react"

interface TokenPriceResult {
  price: number | null
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to fetch token price(s) from the API
 * Supports single token or batched fetching for multiple tokens
 * @param symbols - Single symbol string or array of symbol strings
 * @returns Price data with loading and error states
 */
export function useTokenPrice(symbols: string | string[]): TokenPriceResult {
  const [price, setPrice] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const symbolArray = Array.isArray(symbols) ? symbols : [symbols]
  const isSingle = !Array.isArray(symbols)

  const fetchPrice = useCallback(async () => {
    if (symbolArray.length === 0 || symbolArray.some((s) => !s)) {
      setPrice(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // For single token, fetch directly
      if (isSingle) {
        const response = await fetch(
          `/api/token-price?symbol=${encodeURIComponent(symbolArray[0])}`
        )
        const data = await response.json()

        if (data.success && data.price) {
          setPrice(data.price)
        } else {
          setPrice(null)
          setError(new Error(`Failed to fetch ${symbolArray[0]} price`))
        }
      } else {
        // For multiple tokens, fetch in parallel
        const promises = symbolArray.map((symbol) =>
          fetch(`/api/token-price?symbol=${encodeURIComponent(symbol)}`).then((res) => res.json())
        )

        const results = await Promise.all(promises)
        // For now, return the first price (can be extended to return map)
        const firstResult = results[0]
        if (firstResult.success && firstResult.price) {
          setPrice(firstResult.price)
        } else {
          setPrice(null)
          setError(new Error(`Failed to fetch token prices`))
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setPrice(null)
      console.error("Error fetching token price:", error)
    } finally {
      setIsLoading(false)
    }
  }, [symbolArray.join(","), isSingle])

  useEffect(() => {
    fetchPrice()
  }, [fetchPrice])

  return { price, isLoading, error }
}

/**
 * Hook to fetch multiple token prices independently
 * Returns a map of symbol -> price data
 */
export function useTokenPrices(symbols: string[]): Record<string, TokenPriceResult> {
  const results: Record<string, TokenPriceResult> = {}

  for (const symbol of symbols) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[symbol] = useTokenPrice(symbol)
  }

  return results
}
