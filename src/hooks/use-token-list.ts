"use client"

import { useQuery } from "@tanstack/react-query"
import { SWAP_CACHE_STALE_TIME, SWAP_CACHE_GC_TIME } from "@/lib/constants"
import type { Token } from "@/types/swap"

/**
 * Fetches token list from the API
 */
async function fetchTokenList(): Promise<Token[]> {
  const response = await fetch("/api/tokens")
  if (!response.ok) {
    throw new Error("Failed to fetch token list")
  }
  return response.json()
}

/**
 * Hook to fetch token list with React Query
 * Uses SSR hydration pattern matching useLeaderboardData
 * @param initialData - SSR preloaded token list to hydrate the cache
 */
export function useTokenList(initialData?: Token[]) {
  const shouldUseInitialData = !!initialData

  return useQuery<Token[]>({
    queryKey: ["tokenList"],
    queryFn: fetchTokenList,
    staleTime: SWAP_CACHE_STALE_TIME,
    gcTime: SWAP_CACHE_GC_TIME,
    refetchOnWindowFocus: false,
    // Use SSR data as initial cache to prevent unnecessary refetch
    initialData: shouldUseInitialData ? initialData : undefined,
    initialDataUpdatedAt: shouldUseInitialData ? Date.now() : undefined,
    // Prevent refetch on mount - use cached data, only refetch if stale
    // This prevents lag when navigating between pages
    refetchOnMount: false,
    // Keep previous data visible during background refetch to prevent jumps
    placeholderData: (previousData) => previousData,
    // With staleTime set, React Query will use cached data immediately if fresh
    // and only refetch in background if stale - this prevents black screen
  })
}
