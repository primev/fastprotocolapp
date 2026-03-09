"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  LEADERBOARD_CACHE_STALE_TIME,
  LEADERBOARD_CACHE_GC_TIME,
  DEFAULT_LEADERBOARD_POLL_INTERVAL,
} from "@/lib/constants"
import { getLeaderboardPollIntervalMs } from "@/lib/leaderboard-config"

interface LeaderboardEntry {
  rank: number
  wallet: string
  swapVolume24h: number
  swapCount: number
  change24h: number
  isCurrentUser: boolean
  ethValue: number
}

export interface LeaderboardData {
  success: boolean
  leaderboard: LeaderboardEntry[]
  userPosition?: number | null
  userVolume?: number | null
  nextRankVolume?: number | null
}

interface LeaderboardStats {
  activeTraders: number | null
  swapVolumeEth: number | null
  swapVolumeUsd: number | null
}

/**
 * Fetches leaderboard data from the API
 */
async function fetchLeaderboard(currentUserAddress?: string | null): Promise<LeaderboardData> {
  const url = currentUserAddress
    ? `/api/analytics/leaderboard?currentUser=${currentUserAddress}`
    : `/api/analytics/leaderboard`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard")
  }
  return response.json()
}

/**
 * Fetches leaderboard stats (active traders, volume, etc.)
 */
async function fetchLeaderboardStats(): Promise<LeaderboardStats> {
  const [activeTradersRes, swapVolumeRes] = await Promise.all([
    fetch("/api/analytics/active-traders"),
    fetch("/api/analytics/volume/swap"),
  ])

  const activeTradersData = activeTradersRes.ok ? await activeTradersRes.json() : null
  const swapVolumeData = swapVolumeRes.ok ? await swapVolumeRes.json() : null

  return {
    activeTraders: activeTradersData?.activeTraders ?? null,
    swapVolumeEth: swapVolumeData?.cumulativeSwapVolEth ?? null,
    swapVolumeUsd: swapVolumeData?.cumulativeSwapVolUsd ?? null,
  }
}

/**
 * Hook to read the leaderboard poll interval from Vercel Edge Config.
 * Fetches once, caches indefinitely (Edge Config changes require page reload).
 */
function useLeaderboardPollInterval(): number {
  const { data } = useQuery({
    queryKey: ["leaderboardPollInterval"],
    queryFn: getLeaderboardPollIntervalMs,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })
  return data ?? DEFAULT_LEADERBOARD_POLL_INTERVAL
}

/**
 * Hook to fetch leaderboard data with React Query
 * @param currentUserAddress - Optional wallet address for user-specific data
 * @param initialData - SSR preloaded data to hydrate the cache
 */
export function useLeaderboardData(
  currentUserAddress?: string | null,
  initialData?: LeaderboardData
) {
  const pollInterval = useLeaderboardPollInterval()

  // Strategy: Prioritize user-specific data when address is available
  // Use general leaderboard as placeholder for instant page render
  const isUserSpecificQuery = !!currentUserAddress
  const shouldUseInitialData = initialData && !isUserSpecificQuery

  return useQuery<LeaderboardData>({
    queryKey: ["leaderboard", currentUserAddress || "all"],
    queryFn: () => fetchLeaderboard(currentUserAddress),
    staleTime: isUserSpecificQuery ? 0 : LEADERBOARD_CACHE_STALE_TIME, // Always refetch user-specific queries
    gcTime: LEADERBOARD_CACHE_GC_TIME,
    refetchOnWindowFocus: false,
    // Use SSR data as initial cache only for general leaderboard (no address)
    initialData: shouldUseInitialData ? initialData : undefined,
    initialDataUpdatedAt: shouldUseInitialData ? Date.now() : undefined,
    // Always fetch user-specific data immediately when address is available
    // This ensures user data loads as fast as possible
    refetchOnMount: isUserSpecificQuery ? "always" : shouldUseInitialData ? false : true,
    // Priority optimization: Show general leaderboard immediately while user data loads
    // This makes the page feel instant - leaderboard appears right away, user data fills in
    placeholderData: (previousData) => {
      // Don't use placeholder data from a different address - this prevents showing stale user data
      // When switching wallets, show general leaderboard as placeholder instead
      if (previousData && isUserSpecificQuery) {
        // If we have previous data but it's for a different user, don't use it
        // Use general leaderboard instead
        return initialData
      }
      // If fetching user-specific data, use general leaderboard as placeholder
      // This shows the page structure immediately while user data loads
      if (initialData && isUserSpecificQuery) return initialData
      // For general queries, use previous data if available
      return previousData
    },
    enabled: true,
    // Poll for real-time updates (interval from Vercel Edge Config)
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
  })
}

/**
 * Hook to fetch leaderboard stats with React Query
 * @param initialData - SSR preloaded stats to hydrate the cache
 */
export function useLeaderboardStats(initialData?: LeaderboardStats) {
  const pollInterval = useLeaderboardPollInterval()

  return useQuery<LeaderboardStats>({
    queryKey: ["leaderboardStats"],
    queryFn: fetchLeaderboardStats,
    staleTime: LEADERBOARD_CACHE_STALE_TIME,
    gcTime: LEADERBOARD_CACHE_GC_TIME,
    refetchOnWindowFocus: false,
    // Use SSR data as initial cache to prevent unnecessary refetch
    initialData: initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    // Prevent refetch on mount - use cached data, only refetch if stale
    // This prevents lag when navigating between pages
    refetchOnMount: false,
    // Keep previous data visible during background refetch to prevent jumps
    placeholderData: (previousData) => previousData,
    // Poll for real-time updates (interval from Vercel Edge Config)
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
  })
}

/**
 * Prefetch leaderboard data
 * Use this function to prefetch data before navigating to the leaderboard page
 */
export function usePrefetchLeaderboard() {
  const queryClient = useQueryClient()

  const prefetch = (currentUserAddress?: string | null) => {
    // Prefetch leaderboard data (without user data first, then with user data if address provided)
    queryClient.prefetchQuery({
      queryKey: ["leaderboard", "all"],
      queryFn: () => fetchLeaderboard(null),
      staleTime: LEADERBOARD_CACHE_STALE_TIME,
    })

    // Also prefetch stats
    queryClient.prefetchQuery({
      queryKey: ["leaderboardStats"],
      queryFn: fetchLeaderboardStats,
      staleTime: LEADERBOARD_CACHE_STALE_TIME,
    })

    // If user address is provided, also prefetch user-specific leaderboard data
    if (currentUserAddress) {
      queryClient.prefetchQuery({
        queryKey: ["leaderboard", currentUserAddress],
        queryFn: () => fetchLeaderboard(currentUserAddress),
        staleTime: LEADERBOARD_CACHE_STALE_TIME,
      })
    }
  }

  return { prefetch }
}
