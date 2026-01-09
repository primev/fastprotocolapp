"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { useLeaderboardData, useLeaderboardStats } from "@/hooks/use-leaderboard-data"
import { usePrefetchDashboard } from "@/hooks/use-prefetch-dashboard"

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
  }>
}

export function LeaderboardPageClient({
  preloadedActiveTraders,
  preloadedSwapVolumeEth,
  preloadedEthPrice,
  preloadedLeaderboard,
}: LeaderboardPageClientProps) {
  const [isMounted, setIsMounted] = useState(false)

  const { address } = useAccount()

  // Prefetch dashboard data for faster navigation back to dashboard
  const { prefetch: prefetchDashboard } = usePrefetchDashboard()

  // Fetch leaderboard data using React Query (will use cached data if available from prefetch)
  const { data: leaderboardData, dataUpdatedAt: leaderboardDataUpdatedAt } =
    useLeaderboardData(address)

  // Fetch leaderboard stats using React Query
  const { data: statsData, dataUpdatedAt: statsDataUpdatedAt } = useLeaderboardStats()

  // Prioritize React Query cached data if available and fresh
  const hasFreshCache =
    (leaderboardData && leaderboardDataUpdatedAt) || (statsData && statsDataUpdatedAt)

  // Use React Query cached data if available, otherwise fall back to preloaded server data
  const activeTraders =
    hasFreshCache && statsData?.activeTraders !== undefined
      ? statsData.activeTraders
      : preloadedActiveTraders
  const swapVolumeEth =
    hasFreshCache && statsData?.swapVolumeEth !== undefined
      ? statsData.swapVolumeEth
      : preloadedSwapVolumeEth
  const ethPrice =
    hasFreshCache && statsData?.ethPrice !== undefined ? statsData.ethPrice : preloadedEthPrice
  const leaderboard =
    hasFreshCache && leaderboardData?.leaderboard
      ? leaderboardData.leaderboard
      : preloadedLeaderboard

  // Set mounted immediately to prevent black screen
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prefetch dashboard data when leaderboard loads (for faster navigation back)
  useEffect(() => {
    if (isMounted) {
      prefetchDashboard(address)
    }
  }, [isMounted, address, prefetchDashboard])

  // Layout provides header and paddingTop - content area needs no additional top padding
  return (
    <div className="w-full container mx-auto px-0 sm:px-0 pb-2 md:pb-4 overflow-x-hidden">
      <LeaderboardTable
        address={address}
        preloadedActiveTraders={activeTraders}
        preloadedSwapVolumeEth={swapVolumeEth}
        preloadedEthPrice={ethPrice}
        preloadedData={
          leaderboardData
            ? {
                success: leaderboardData.success,
                leaderboard: leaderboardData.leaderboard,
                userPosition: leaderboardData.userPosition,
                userVolume: leaderboardData.userVolume,
                nextRankVolume: leaderboardData.nextRankVolume,
              }
            : {
                success: true,
                leaderboard: leaderboard,
              }
        }
      />
    </div>
  )
}
