"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { LEADERBOARD_CACHE_STALE_TIME, LEADERBOARD_CACHE_GC_TIME } from "@/lib/config/constants"
import { REFETCH_MILES_EVENT } from "@/lib/miles-events"

export interface FuulMilesEntry {
  wallet: string
  points: number
  referrals: number
  rank: number
}

export interface FuulMilesLeaderboard {
  entries: FuulMilesEntry[]
  totalParticipants: number
  totalMiles: number
}

export const FUUL_MILES_LEADERBOARD_QUERY_KEY = ["fuulMilesLeaderboard"] as const

async function fetchFuulMilesLeaderboard(refresh = false): Promise<FuulMilesLeaderboard> {
  const url = `/api/fuul/leaderboard?limit=100&page=1&sort=miles${refresh ? "&refresh=1" : ""}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch miles leaderboard: ${res.status}`)
  const json = await res.json()
  const entries: FuulMilesEntry[] = (json.entries ||
    json.byPoints?.map((e: FuulMilesEntry, i: number) => ({ ...e, rank: i + 1 })) ||
    []) as FuulMilesEntry[]

  const totalParticipants =
    typeof json.totalParticipants === "number" ? json.totalParticipants : entries.length
  const totalMiles =
    typeof json.totalMiles === "number"
      ? json.totalMiles
      : entries.reduce((sum, e) => sum + e.points, 0)

  return { entries, totalParticipants, totalMiles }
}

/**
 * Shared React Query-backed fetch of the Fuul miles leaderboard.
 * Consumers (LeaderboardTable, AppHeader via useUserPoints) read the same
 * cache, guaranteeing the connected user's Miles badge matches their
 * leaderboard row. Listens for `refetch-user-miles` events (fired when a
 * swap transitions from pending → processed) and refetches with a
 * server-cache bust so fresh settlement data is reflected immediately.
 */
export function useFuulMilesLeaderboard() {
  const queryClient = useQueryClient()

  const query = useQuery<FuulMilesLeaderboard>({
    queryKey: FUUL_MILES_LEADERBOARD_QUERY_KEY,
    queryFn: () => fetchFuulMilesLeaderboard(false),
    staleTime: LEADERBOARD_CACHE_STALE_TIME,
    gcTime: LEADERBOARD_CACHE_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  useEffect(() => {
    const handler = () => {
      queryClient.fetchQuery({
        queryKey: FUUL_MILES_LEADERBOARD_QUERY_KEY,
        queryFn: () => fetchFuulMilesLeaderboard(true),
        staleTime: 0,
      })
    }
    window.addEventListener(REFETCH_MILES_EVENT, handler)
    return () => window.removeEventListener(REFETCH_MILES_EVENT, handler)
  }, [queryClient])

  return query
}

/** Returns the leaderboard entry for the given wallet, or null. */
export function findUserMilesEntry(
  data: FuulMilesLeaderboard | undefined,
  address: string | undefined | null
): FuulMilesEntry | null {
  if (!data || !address) return null
  const trimmed = trimWalletAddress(address.toLowerCase())
  return data.entries.find((e) => e.wallet === trimmed) ?? null
}
