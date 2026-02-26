"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"

interface WaitlistPositionData {
  position: number | null
  total: number
}

async function fetchWaitlistPosition(address: string): Promise<WaitlistPositionData> {
  const res = await fetch(`/api/waitlist/position?address=${encodeURIComponent(address)}`)
  if (!res.ok) throw new Error("Waitlist position fetch failed")
  return res.json()
}

export interface UseWaitlistPositionReturn {
  position: number | null
  total: number
  isLoading: boolean
  error: Error | null
}

export function useWaitlistPosition(): UseWaitlistPositionReturn {
  const { address, isConnected } = useAccount()

  const { data, isLoading, error } = useQuery({
    queryKey: ["waitlist", "position", address],
    queryFn: () => fetchWaitlistPosition(address!),
    enabled: Boolean(isConnected && address),
    staleTime: 5 * 60 * 1000,
  })

  return {
    position: data?.position ?? null,
    total: data?.total ?? 0,
    isLoading,
    error: error as Error | null,
  }
}
