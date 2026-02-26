"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"

async function fetchAcceptedInvite(address: string): Promise<{ accepted: boolean }> {
  const res = await fetch(`/api/waitlist/accept-invite?address=${encodeURIComponent(address)}`)
  if (!res.ok) throw new Error("Failed to check accepted invite")
  return res.json()
}

/**
 * Check whether the connected wallet has accepted their whitelist invite.
 * Only enabled when the wallet is whitelisted (canSwap = true).
 */
export function useAcceptedInvite(canSwap: boolean) {
  const { address, isConnected } = useAccount()

  const { data, isLoading } = useQuery({
    queryKey: ["waitlist", "accepted-invite", address],
    queryFn: () => fetchAcceptedInvite(address!),
    enabled: canSwap && isConnected && Boolean(address),
    staleTime: 5 * 60 * 1000,
  })

  return {
    accepted: data?.accepted ?? false,
    isLoading: canSwap ? isLoading : false,
  }
}
