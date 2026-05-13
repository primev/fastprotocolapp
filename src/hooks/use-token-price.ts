"use client"

import { useState, useEffect, useCallback } from "react"

interface TokenPriceResult {
  price: number | null
  isLoading: boolean
  error: Error | null
}

// Per-symbol plausibility bounds. The API has been observed returning ~$1
// for ETH during transient backend issues, which cascades into miles
// surplus blow-ups (one user saw 30,927 miles instead of ~17). When an
// out-of-range price comes back, skip the update and keep the previous
// good value rather than poisoning every downstream consumer.
const SANE_PRICE_BOUNDS: Record<string, { min: number; max: number }> = {
  ETH: { min: 100, max: 100_000 },
  WETH: { min: 100, max: 100_000 },
  USDC: { min: 0.5, max: 2 },
  USDT: { min: 0.5, max: 2 },
  DAI: { min: 0.5, max: 2 },
}

function isPriceSane(symbol: string, price: number): boolean {
  const bounds = SANE_PRICE_BOUNDS[symbol.toUpperCase()]
  if (!bounds) return true
  return price >= bounds.min && price <= bounds.max
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
          if (isPriceSane(symbolArray[0], data.price)) {
            setPrice(data.price)
          } else {
            console.warn(
              `[useTokenPrice] rejected implausible ${symbolArray[0]} price: ${data.price} — keeping previous value`
            )
          }
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
          if (isPriceSane(symbolArray[0], firstResult.price)) {
            setPrice(firstResult.price)
          } else {
            console.warn(
              `[useTokenPrice] rejected implausible ${symbolArray[0]} price: ${firstResult.price} — keeping previous value`
            )
          }
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
