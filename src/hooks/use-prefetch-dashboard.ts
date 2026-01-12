"use client"

import { useRouter } from "next/navigation"
import { usePrefetchDashboardData } from "./use-dashboard-data"

/**
 * Hook to prefetch dashboard data for faster navigation
 * Prefetches API endpoints and routes used by the dashboard
 * Now uses unified React Query hooks for consistency
 */
export function usePrefetchDashboard() {
  const router = useRouter()
  const { prefetch: prefetchDashboardData } = usePrefetchDashboardData()

  const prefetch = (address?: string | null) => {
    // Prefetch Next.js route (will prefetch the page component)
    router.prefetch("/dashboard")

    // Prefetch dashboard data using unified hooks
    prefetchDashboardData(address)
  }

  return { prefetch }
}
