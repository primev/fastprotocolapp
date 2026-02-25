"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { FEATURE_FLAGS } from "@/lib/feature-flags"
import { fetchWhitelistList } from "@/lib/gate-data"

const WHITELIST_STALE_TIME_MS = 5 * 60 * 1000

async function fetchWhitelistStatus(address: string): Promise<{ whitelisted: boolean }> {
  const res = await fetch(`/api/whitelist/check?address=${encodeURIComponent(address)}`)
  if (!res.ok) {
    throw new Error("Whitelist check failed")
  }
  return res.json()
}

export interface UseWhitelistReturn {
  isWhitelisted: boolean
  isLoading: boolean
  error: Error | null
}

export function useWhitelist(): UseWhitelistReturn {
  const { address, isConnected } = useAccount()

  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ["whitelist", "list"],
    queryFn: fetchWhitelistList,
    enabled: FEATURE_FLAGS.swap_whitelist_enabled,
    staleTime: WHITELIST_STALE_TIME_MS,
  })

  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ["whitelist", address],
    queryFn: () => fetchWhitelistStatus(address!),
    enabled:
      FEATURE_FLAGS.swap_whitelist_enabled &&
      Boolean(isConnected && address) &&
      !listData?.addresses,
    staleTime: WHITELIST_STALE_TIME_MS,
  })

  if (!isConnected || !address) {
    return { isWhitelisted: false, isLoading: false, error: null }
  }

  if (!FEATURE_FLAGS.swap_whitelist_enabled) {
    return { isWhitelisted: true, isLoading: false, error: null }
  }

  if (listData?.addresses) {
    const normalized = address.toLowerCase().trim()
    const whitelisted = listData.addresses.includes(normalized)
    return { isWhitelisted: whitelisted, isLoading: false, error: null }
  }

  if (statusData !== undefined) {
    return {
      isWhitelisted: statusData.whitelisted,
      isLoading: false,
      error: null,
    }
  }

  return {
    isWhitelisted: false,
    isLoading: isListLoading || isStatusLoading,
    error: null,
  }
}
