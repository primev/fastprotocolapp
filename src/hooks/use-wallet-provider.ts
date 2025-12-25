import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { getProviderForConnector, getWalletTypeFromConnector } from "@/lib/wallet-provider"

export interface UseWalletProviderReturn {
  provider: any | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to get the wallet provider from the connected connector
 * Handles multiple fallback strategies to ensure provider availability
 */
export function useWalletProvider(connector?: any): UseWalletProviderReturn {
  const { connector: accountConnector } = useAccount()
  const activeConnector = connector || accountConnector

  const [provider, setProvider] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchProvider = useCallback(async () => {
    if (!activeConnector) {
      setProvider(null)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get the specific provider for the connected wallet to avoid conflicts
      let foundProvider = null

      // First try: Get provider directly from connector
      try {
        foundProvider = await activeConnector.getProvider()
      } catch (error) {
        console.error("Error getting provider from connector:", error)
      }

      // Second try: Fallback to getProviderForConnector if connector.getProvider fails
      if (!foundProvider) {
        foundProvider = await getProviderForConnector(activeConnector)
      }

      // Third try: Final fallback to window.ethereum (most reliable)
      // Handle case where window.ethereum might be a getter-only property (multi-wallet conflict)
      if (!foundProvider && typeof window !== "undefined") {
        try {
          const ethereum = (window as any).ethereum
          if (ethereum) {
            // If it's an array, find the correct provider
            if (Array.isArray(ethereum)) {
              // Try to find the provider that matches the connector
              const walletType = getWalletTypeFromConnector(activeConnector)
              if (walletType === "metamask") {
                foundProvider = ethereum.find((p: any) => p && p.isMetaMask === true && !p.isRabby)
              } else if (walletType === "rabby") {
                foundProvider = ethereum.find((p: any) => p && p.isRabby === true)
              }
              // Fallback to first provider if not found
              if (!foundProvider) {
                foundProvider = ethereum[0]
              }
            } else {
              foundProvider = ethereum
            }
          }
        } catch (error) {
          // Silently handle cases where window.ethereum is getter-only (multi-wallet conflict)
          // This is expected when multiple wallet extensions are installed
          console.debug("Could not access window.ethereum (multi-wallet conflict):", error)
        }
      }

      if (!foundProvider) {
        throw new Error("Provider not available")
      }

      // Verify provider has request method
      if (!foundProvider.request || typeof foundProvider.request !== "function") {
        throw new Error("Provider not ready")
      }

      setProvider(foundProvider)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setProvider(null)
    } finally {
      setIsLoading(false)
    }
  }, [activeConnector])

  useEffect(() => {
    fetchProvider()
  }, [fetchProvider])

  return {
    provider,
    isLoading,
    error,
    refetch: fetchProvider,
  }
}
