"use client"

import { useState, useEffect, useCallback } from "react"
import { createPublicClient, http, formatUnits } from "viem"
import { mainnet } from "wagmi/chains"
import { FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"

interface UseGasPriceReturn {
  gasPrice: bigint | null
  gasPriceGwei: number | null
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to fetch current gas price from the network
 * Returns gas price in wei and gwei for easy use
 */
export function useGasPrice(): UseGasPriceReturn {
  const [gasPrice, setGasPrice] = useState<bigint | null>(null)
  const [gasPriceGwei, setGasPriceGwei] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchGasPrice = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const client = createPublicClient({
        chain: mainnet,
        transport: http(FALLBACK_RPC_ENDPOINT, {
          fetchOptions: { cache: "no-store" },
        }),
      })

      // Fetch current gas price
      const price = await client.getGasPrice()

      setGasPrice(price)
      // Convert to gwei for display
      const gwei = parseFloat(formatUnits(price, 9))
      setGasPriceGwei(gwei)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setGasPrice(null)
      setGasPriceGwei(null)
      console.error("Error fetching gas price:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGasPrice()
    // Refresh gas price every 30 seconds
    const interval = setInterval(fetchGasPrice, 30000)
    return () => clearInterval(interval)
  }, [fetchGasPrice])

  return {
    gasPrice,
    gasPriceGwei,
    isLoading,
    error,
  }
}
