"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LEADERBOARD_CACHE_STALE_TIME, LEADERBOARD_CACHE_GC_TIME } from "@/lib/constants"

interface LeaderboardEntry {
  rank: number
  wallet: string
  swapVolume24h: number
  swapCount: number
  change24h: number
  isCurrentUser: boolean
}

interface LeaderboardData {
  success: boolean
  leaderboard: LeaderboardEntry[]
  userPosition?: number | null
  userVolume?: number | null
  nextRankVolume?: number | null
  ethPrice?: number | null
}

interface LeaderboardStats {
  activeTraders: number | null
  swapVolumeEth: number | null
  ethPrice: number | null
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
  const [activeTradersRes, swapVolumeRes, ethPriceRes] = await Promise.all([
    fetch("/api/analytics/active-traders"),
    fetch("/api/analytics/volume/swap"),
    fetch("/api/analytics/eth-price"),
  ])

  const activeTradersData = activeTradersRes.ok ? await activeTradersRes.json() : null
  const swapVolumeData = swapVolumeRes.ok ? await swapVolumeRes.json() : null
  const ethPriceData = ethPriceRes.ok ? await ethPriceRes.json() : null

  return {
    activeTraders: activeTradersData?.activeTraders ?? null,
    swapVolumeEth: swapVolumeData?.cumulativeSwapVolEth ?? null,
    ethPrice: ethPriceData?.ethPrice ?? null,
  }
}

/**
 * Hook to fetch leaderboard data with React Query
 */
export function useLeaderboardData(currentUserAddress?: string | null) {
  return useQuery<LeaderboardData>({
    queryKey: ["leaderboard", currentUserAddress || "all"],
    queryFn: () => fetchLeaderboard(currentUserAddress),
    staleTime: LEADERBOARD_CACHE_STALE_TIME,
    gcTime: LEADERBOARD_CACHE_GC_TIME,
    refetchOnWindowFocus: false,
    // With staleTime set, React Query will use cached data immediately if fresh
    // and only refetch in background if stale - this prevents black screen
  })
}

/**
 * Hook to fetch leaderboard stats with React Query
 */
export function useLeaderboardStats() {
  return useQuery<LeaderboardStats>({
    queryKey: ["leaderboardStats"],
    queryFn: fetchLeaderboardStats,
    staleTime: LEADERBOARD_CACHE_STALE_TIME,
    gcTime: LEADERBOARD_CACHE_GC_TIME,
    refetchOnWindowFocus: false,
    // With staleTime set, React Query will use cached data immediately if fresh
    // and only refetch in background if stale - this prevents black screen
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
