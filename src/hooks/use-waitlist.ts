"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { FEATURE_FLAGS } from "@/lib/config/feature-flags"
import { fetchWaitlistList } from "@/lib/gate-data"

const WAITLIST_STALE_TIME_MS = 5 * 60 * 1000

async function fetchWaitlistStatus(address: string): Promise<{ onWaitlist: boolean }> {
  const res = await fetch(`/api/waitlist/check?address=${encodeURIComponent(address)}`)
  if (!res.ok) {
    throw new Error("Waitlist check failed")
  }
  const data = await res.json()
  return { onWaitlist: data.onWaitlist ?? false }
}

export interface UseWaitlistReturn {
  onWaitlist: boolean
  isLoading: boolean
  error: Error | null
}

export function useWaitlist(): UseWaitlistReturn {
  const { address, isConnected } = useAccount()

  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ["waitlist", "list"],
    queryFn: fetchWaitlistList,
    enabled: FEATURE_FLAGS.swap_whitelist_enabled,
    staleTime: WAITLIST_STALE_TIME_MS,
  })

  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ["waitlist", address],
    queryFn: () => fetchWaitlistStatus(address!),
    enabled:
      FEATURE_FLAGS.swap_whitelist_enabled &&
      Boolean(isConnected && address) &&
      !listData?.addresses,
    staleTime: WAITLIST_STALE_TIME_MS,
  })

  if (!isConnected || !address) {
    return { onWaitlist: false, isLoading: false, error: null }
  }

  if (!FEATURE_FLAGS.swap_whitelist_enabled) {
    return { onWaitlist: true, isLoading: false, error: null }
  }

  if (listData?.addresses) {
    const normalized = address.toLowerCase().trim()
    const onWaitlist = listData.addresses.includes(normalized)
    return { onWaitlist, isLoading: false, error: null }
  }

  if (statusData !== undefined) {
    return {
      onWaitlist: statusData.onWaitlist,
      isLoading: false,
      error: null,
    }
  }

  return {
    onWaitlist: false,
    isLoading: isListLoading || isStatusLoading,
    error: null,
  }
}
