"use client"

import { useState, useEffect, useRef } from "react"
import { useAccount } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import {
  useLeaderboardData,
  useLeaderboardStats,
  type LeaderboardData,
} from "@/hooks/use-leaderboard-data"
import { usePrefetchDashboard } from "@/hooks/use-prefetch-dashboard"
import { LEADERBOARD_CACHE_STALE_TIME } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"

// Components
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable"

// Leaderboard page client - uses shared (app) layout for header and RPC/network modals
interface LeaderboardPageClientProps {
  preloadedActiveTraders: number | null
  preloadedSwapVolumeEth: number | null
  preloadedEthPrice: number | null
  preloadedLeaderboard: Array<{
    rank: number
    wallet: string
    swapVolume24h: number
    swapCount: number
    change24h: number
    isCurrentUser: boolean
    ethValue: number
  }>
}

export function LeaderboardPageClient({
  preloadedActiveTraders,
  preloadedSwapVolumeEth,
  preloadedEthPrice,
  preloadedLeaderboard,
}: LeaderboardPageClientProps) {
  const [isMounted, setIsMounted] = useState(false)
  const queryClient = useQueryClient()
  const { address } = useAccount()

  // Prefetch dashboard data for faster navigation back to dashboard
  const { prefetch: prefetchDashboard } = usePrefetchDashboard()

  // Prepare initial data for React Query hydration
  const initialLeaderboardData =
    preloadedLeaderboard.length > 0
      ? {
          success: true,
          leaderboard: preloadedLeaderboard,
          ethPrice: preloadedEthPrice,
        }
      : undefined

  const initialStatsData =
    preloadedActiveTraders !== null || preloadedSwapVolumeEth !== null || preloadedEthPrice !== null
      ? {
          activeTraders: preloadedActiveTraders,
          swapVolumeEth: preloadedSwapVolumeEth,
          ethPrice: preloadedEthPrice,
        }
      : undefined

  // Priority: Fetch user-specific data immediately when address is available
  // Use general leaderboard as placeholder so page renders instantly
  const {
    data: leaderboardData,
    isLoading: isLeaderboardLoading,
    isFetching: isLeaderboardFetching,
    refetch: refetchLeaderboard,
  } = useLeaderboardData(
    address,
    // Strategy:
    // - If no address: use SSR general leaderboard as initialData
    // - If address exists: pass general leaderboard so it can be used as placeholder
    //   This shows the leaderboard immediately while user-specific data loads in parallel
    initialLeaderboardData
  )

  // Fetch leaderboard stats using React Query with SSR hydration
  const { data: statsData, isFetching: isStatsFetching } = useLeaderboardStats(initialStatsData)

  // Set mounted immediately to prevent black screen
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Track previous address to detect changes
  const prevAddressRef = useRef<string | undefined>(address)

  // Priority: Fetch user-specific data immediately when address is available
  // Also invalidate and refetch when address changes to ensure fresh data
  useEffect(() => {
    if (!isMounted) return

    // Check if address actually changed
    const addressChanged = prevAddressRef.current !== address
    prevAddressRef.current = address

    if (addressChanged) {
      // When address changes, invalidate queries to mark them as stale
      // Then fetch the new query directly to ensure it loads
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] })

      // Directly fetch the new query to ensure it loads immediately
      const queryKey = address ? ["leaderboard", address] : ["leaderboard", "all"]
      queryClient.fetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await fetch(
            address
              ? `/api/analytics/leaderboard?currentUser=${address}`
              : `/api/analytics/leaderboard`
          )
          if (!response.ok) throw new Error("Failed to fetch leaderboard")
          return response.json()
        },
        staleTime: 0, // Always fetch fresh data when address changes
      })
    }
  }, [address, isMounted, queryClient])

  // Prefetch dashboard data when leaderboard loads (debounced to avoid lag)
  useEffect(() => {
    if (isMounted) {
      // Delay prefetch to avoid blocking initial render
      const timeoutId = setTimeout(() => {
        prefetchDashboard(address)
      }, 500) // Wait 500ms after mount before prefetching
      return () => clearTimeout(timeoutId)
    }
  }, [isMounted, address, prefetchDashboard])

  // Only show loading if we have NO data at all (should be rare with SSR)
  // Don't show loading during background refetches - we have placeholderData for that
  const hasAnyData = leaderboardData || preloadedLeaderboard.length > 0
  const isLoading = isLeaderboardLoading && !hasAnyData
  const isFetching = isLeaderboardFetching || isStatsFetching

  // Layout provides header and paddingTop - content area needs no additional top padding
  return (
    <div className="w-full container mx-auto px-0 sm:px-0 pb-2 md:pb-4 overflow-x-hidden relative">
      {/* Show subtle indicator for background refresh - only if we have data */}
      {isFetching && hasAnyData && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2">
          <Badge variant="secondary" className="text-xs">
            Refreshing...
          </Badge>
        </div>
      )}
      <LeaderboardTable
        address={address}
        leaderboardData={leaderboardData}
        statsData={statsData}
        isLoading={isLoading}
        isFetching={isFetching}
      />
    </div>
  )
}
