import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { createPublicClient, http, type Address } from "viem"
import { mainnet } from "wagmi/chains"
import { FALLBACK_RPC_ENDPOINT, RPC_ENDPOINT } from "@/lib/network-config"

export interface UseReadOnlyContractCallProps {
  contractAddress: string
  abi: readonly any[] | any[]
  functionName: string
  args?: any[]
  enabled?: boolean
}

export interface UseReadOnlyContractCallReturn<T = any> {
  data: T | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook for making read-only contract calls using wagmi's readContract
 * Uses wagmi's configured public client which handles RPC endpoints automatically
 */
export function useReadOnlyContractCall<T = any>({
  contractAddress,
  abi,
  functionName,
  args = [],
  enabled = true,
}: UseReadOnlyContractCallProps): UseReadOnlyContractCallReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const lastFetchKeyRef = useRef<string>("")

  // Memoize args to prevent unnecessary refetches
  const argsString = useMemo(() => JSON.stringify(args), [args])
  const stableArgs = useMemo(() => args, [argsString])

  // Create a unique key for this fetch based on all dependencies
  const fetchKey = useMemo(
    () => `${contractAddress}-${functionName}-${argsString}-${enabled}`,
    [contractAddress, functionName, argsString, enabled]
  )

  const fetchData = useCallback(async () => {
    if (!enabled) {
      return
    }

    // Prevent duplicate fetches with the same key
    if (lastFetchKeyRef.current === fetchKey && data !== null) {
      return
    }

    setIsLoading(true)
    setError(null)
    lastFetchKeyRef.current = fetchKey

    try {
      // Ensure args are passed correctly - if empty array, pass undefined
      const contractArgs = stableArgs.length > 0 ? (stableArgs as any) : undefined

      // Try Fast RPC first, then fallback to public RPC
      let result: any = null
      let lastError: Error | null = null

      // Primary: Fast RPC endpoint
      try {
        const fastRpcClient = createPublicClient({
          chain: mainnet,
          transport: http(RPC_ENDPOINT, {
            fetchOptions: {
              cache: "no-store", // Disable HTTP caching
            },
          }),
        })

        result = await fastRpcClient.readContract({
          address: contractAddress as Address,
          abi: abi as any,
          functionName: functionName as any,
          args: contractArgs,
          blockTag: "latest", // Always use latest block to avoid stale data
        } as any)

        // If result is 0 or null, try fallback (might be stale data)
        if (result === BigInt(0) || result === null || result === undefined) {
          throw new Error("Fast RPC returned zero/null, trying fallback")
        }
      } catch (fastRpcError) {
        lastError = fastRpcError instanceof Error ? fastRpcError : new Error(String(fastRpcError))
        console.warn("Fast RPC call failed or returned zero, trying fallback:", lastError)

        // Fallback: Public RPC endpoint
        try {
          const publicRpcClient = createPublicClient({
            chain: mainnet,
            transport: http(FALLBACK_RPC_ENDPOINT, {
              fetchOptions: {
                cache: "no-store",
              },
            }),
          })

          result = await publicRpcClient.readContract({
            address: contractAddress as Address,
            abi: abi as any,
            functionName: functionName as any,
            args: contractArgs,
            blockTag: "latest",
          } as any)

          console.log("Fallback RPC call succeeded:", result?.toString())
        } catch (fallbackError) {
          // Both failed, throw the original error
          throw lastError
        }
      }

      // Result is already in the correct format (bigint for numbers)
      setData(result as T)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setData(null)
      lastFetchKeyRef.current = "" // Allow retry on error
      console.error(`Error calling ${functionName}:`, error)
    } finally {
      setIsLoading(false)
    }
  }, [contractAddress, abi, functionName, stableArgs, enabled, fetchKey, data])

  useEffect(() => {
    fetchData()
  }, [fetchKey, fetchData])

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  }
}
