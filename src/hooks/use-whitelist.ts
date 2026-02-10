"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"

const WHITELIST_STALE_TIME_MS = 5 * 60 * 1000 // 5 minutes

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

  const { data, isLoading, error } = useQuery({
    queryKey: ["whitelist", address],
    queryFn: () => fetchWhitelistStatus(address!),
    enabled: Boolean(isConnected && address),
    staleTime: WHITELIST_STALE_TIME_MS,
  })

  if (!isConnected || !address) {
    return { isWhitelisted: false, isLoading: false, error: null }
  }

  return {
    isWhitelisted: data?.whitelisted ?? false,
    isLoading,
    error: error instanceof Error ? error : null,
  }
}
