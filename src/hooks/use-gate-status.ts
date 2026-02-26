"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAccount } from "wagmi"

export interface GateStatusData {
  whitelisted: boolean
  approved: boolean
  onWaitlist: boolean
  acceptedInvite: boolean
  position: number | null
  total: number
}

async function fetchGateStatus(address: string): Promise<GateStatusData> {
  const res = await fetch(`/api/gate/status?address=${encodeURIComponent(address)}`)
  if (!res.ok) throw new Error("Gate status check failed")
  return res.json()
}

export const GATE_STATUS_QUERY_KEY = "gate-status"

export function useGateStatus() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: [GATE_STATUS_QUERY_KEY, address],
    queryFn: () => fetchGateStatus(address!),
    enabled: Boolean(isConnected && address),
    staleTime: 5 * 60 * 1000,
  })

  const setAcceptedInvite = useCallback(() => {
    if (!address) return
    queryClient.setQueryData<GateStatusData>([GATE_STATUS_QUERY_KEY, address], (prev) =>
      prev ? { ...prev, acceptedInvite: true } : prev
    )
  }, [address, queryClient])

  const setOnWaitlist = useCallback(
    (position: number, total: number) => {
      if (!address) return
      queryClient.setQueryData<GateStatusData>([GATE_STATUS_QUERY_KEY, address], (prev) => ({
        whitelisted: prev?.whitelisted ?? false,
        approved: prev?.approved ?? false,
        onWaitlist: true,
        acceptedInvite: prev?.acceptedInvite ?? false,
        position,
        total,
      }))
    },
    [address, queryClient]
  )

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [GATE_STATUS_QUERY_KEY] })
  }, [queryClient])

  // A user is "pre-approved" if they're on the whitelist OR approved on the waitlist (col F)
  const isPreApproved = (data?.whitelisted ?? false) || (data?.approved ?? false)

  if (!isConnected || !address) {
    return {
      isPreApproved: false,
      onWaitlist: false,
      acceptedInvite: false,
      position: null as number | null,
      total: 0,
      isLoading: false,
      setAcceptedInvite,
      setOnWaitlist,
      invalidate,
    }
  }

  return {
    isPreApproved,
    onWaitlist: data?.onWaitlist ?? false,
    acceptedInvite: data?.acceptedInvite ?? false,
    position: data?.position ?? null,
    total: data?.total ?? 0,
    isLoading,
    setAcceptedInvite,
    setOnWaitlist,
    invalidate,
  }
}
