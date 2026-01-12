"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DASHBOARD_CACHE_STALE_TIME, DASHBOARD_CACHE_GC_TIME } from "@/lib/constants"

export type UserOnboardingData = {
  connect_wallet_completed: boolean
  setup_rpc_completed: boolean
  mint_sbt_completed: boolean
  x_completed: boolean
  telegram_completed: boolean
  discord_completed: boolean
  email_completed: boolean
}

interface UserOnboardingResponse {
  user: UserOnboardingData | null
}

interface UserAnalyticsData {
  totalTxs: number
  swapTxs: number
  totalSwapVolEth: number
  ethPrice: number | null
}

/**
 * Fetches user onboarding data from the API
 */
async function fetchUserOnboarding(address: string): Promise<UserOnboardingResponse> {
  const response = await fetch(`/api/user-onboarding/${address}`)
  if (response.ok) {
    return response.json()
  } else if (response.status === 404) {
    // User doesn't exist yet, that's okay
    return { user: null }
  }
  throw new Error("Failed to fetch user onboarding")
}

/**
 * Fetches user analytics data from the API
 */
async function fetchUserAnalytics(address: string): Promise<UserAnalyticsData> {
  const response = await fetch(`/api/analytics/user/${address}`)
  if (!response.ok) {
    throw new Error("Failed to fetch user analytics")
  }
  const data = await response.json()
  return {
    totalTxs: data.totalTxs || 0,
    swapTxs: data.swapTxs || 0,
    totalSwapVolEth: data.totalSwapVolEth || 0,
    ethPrice: data.ethPrice !== null && data.ethPrice !== undefined ? Number(data.ethPrice) : null,
  }
}

/**
 * Hook to fetch user onboarding data with React Query
 */
export function useUserOnboardingData(address: string | undefined) {
  return useQuery<UserOnboardingResponse>({
    queryKey: ["userOnboarding", address || ""],
    queryFn: () => fetchUserOnboarding(address!),
    enabled: !!address,
    staleTime: DASHBOARD_CACHE_STALE_TIME,
    gcTime: DASHBOARD_CACHE_GC_TIME,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to fetch user analytics data with React Query
 */
export function useUserAnalyticsData(address: string | undefined) {
  return useQuery<UserAnalyticsData>({
    queryKey: ["userAnalytics", address || ""],
    queryFn: () => fetchUserAnalytics(address!),
    enabled: !!address,
    staleTime: DASHBOARD_CACHE_STALE_TIME,
    gcTime: DASHBOARD_CACHE_GC_TIME,
    refetchOnWindowFocus: false,
  })
}

/**
 * Combined hook for all dashboard data
 * Returns all dashboard-related data in a single object
 */
export function useDashboardData(address: string | undefined) {
  const userOnboarding = useUserOnboardingData(address)
  const userAnalytics = useUserAnalyticsData(address)

  return {
    userOnboarding: userOnboarding.data?.user ?? null,
    isLoadingOnboarding: userOnboarding.isLoading,
    hasInitializedOnboarding: userOnboarding.isFetched || userOnboarding.isError,
    userOnboardingError: userOnboarding.error,
    userAnalytics: userAnalytics.data ?? null,
    isLoadingAnalytics: userAnalytics.isLoading,
    userAnalyticsError: userAnalytics.error,
    isLoading: userOnboarding.isLoading || userAnalytics.isLoading,
  }
}

/**
 * Prefetch dashboard data
 * Use this function to prefetch data before navigating to the dashboard page
 */
export function usePrefetchDashboardData() {
  const queryClient = useQueryClient()

  const prefetch = (address: string | null | undefined) => {
    if (!address) return

    // Prefetch user onboarding data
    queryClient.prefetchQuery({
      queryKey: ["userOnboarding", address],
      queryFn: () => fetchUserOnboarding(address),
      staleTime: DASHBOARD_CACHE_STALE_TIME,
    })

    // Prefetch user analytics data
    queryClient.prefetchQuery({
      queryKey: ["userAnalytics", address],
      queryFn: () => fetchUserAnalytics(address),
      staleTime: DASHBOARD_CACHE_STALE_TIME,
    })
  }

  return { prefetch }
}
