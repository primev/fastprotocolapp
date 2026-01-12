"use client"

import { useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePrefetchLeaderboard } from "./use-leaderboard-data"
import { usePrefetchDashboard } from "./use-prefetch-dashboard"

/**
 * Unified hook for prefetching pages (routes + data)
 * Handles both dashboard and leaderboard prefetching with debouncing
 * Used by header navigation buttons and page components
 */
export function usePagePrefetch() {
  const router = useRouter()
  const { prefetch: prefetchLeaderboard } = usePrefetchLeaderboard()
  const { prefetch: prefetchDashboard } = usePrefetchDashboard()

  // Debounce refs to prevent excessive prefetching on rapid hover events
  const leaderboardPrefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dashboardPrefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Prefetch leaderboard page and data
   * Debounced to prevent excessive prefetching on rapid hover events
   */
  const prefetchLeaderboardPage = useCallback(
    (address?: string | null) => {
      // Clear existing timeout
      if (leaderboardPrefetchTimeoutRef.current) {
        clearTimeout(leaderboardPrefetchTimeoutRef.current)
      }

      // Debounce prefetch by 100ms to avoid excessive prefetching on rapid hover
      leaderboardPrefetchTimeoutRef.current = setTimeout(() => {
        // Prefetch route
        router.prefetch("/leaderboard")
        // Prefetch data
        prefetchLeaderboard(address)
      }, 100)
    },
    [router, prefetchLeaderboard]
  )

  /**
   * Prefetch dashboard page and data
   * Debounced to prevent excessive prefetching on rapid hover events
   */
  const prefetchDashboardPage = useCallback(
    (address?: string | null) => {
      // Clear existing timeout
      if (dashboardPrefetchTimeoutRef.current) {
        clearTimeout(dashboardPrefetchTimeoutRef.current)
      }

      // Debounce prefetch by 100ms to avoid excessive prefetching on rapid hover
      dashboardPrefetchTimeoutRef.current = setTimeout(() => {
        // Prefetch route and data (usePrefetchDashboard handles both)
        prefetchDashboard(address)
      }, 100)
    },
    [prefetchDashboard]
  )

  /**
   * Cleanup function to clear timeouts
   */
  const cleanup = useCallback(() => {
    if (leaderboardPrefetchTimeoutRef.current) {
      clearTimeout(leaderboardPrefetchTimeoutRef.current)
      leaderboardPrefetchTimeoutRef.current = null
    }
    if (dashboardPrefetchTimeoutRef.current) {
      clearTimeout(dashboardPrefetchTimeoutRef.current)
      dashboardPrefetchTimeoutRef.current = null
    }
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    prefetchLeaderboardPage,
    prefetchDashboardPage,
    cleanup,
  }
}

/**
 * Hook specifically for hover prefetching
 * Provides onMouseEnter handlers for header buttons
 */
export function usePrefetchOnHover() {
  const { prefetchLeaderboardPage, prefetchDashboardPage } = usePagePrefetch()

  const handleLeaderboardHover = useCallback(
    (address?: string | null) => () => {
      prefetchLeaderboardPage(address)
    },
    [prefetchLeaderboardPage]
  )

  const handleDashboardHover = useCallback(
    (address?: string | null) => () => {
      prefetchDashboardPage(address)
    },
    [prefetchDashboardPage]
  )

  return {
    handleLeaderboardHover,
    handleDashboardHover,
  }
}
