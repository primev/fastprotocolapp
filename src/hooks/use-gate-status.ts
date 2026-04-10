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

// ---------------------------------------------------------------------------
// Session-scoped approval cache
//
// Once a user is approved, we cache that fact in sessionStorage so
// subsequent page loads within the same tab skip the API call entirely
// (no skeleton, no latency). The cache clears when the tab closes,
// ensuring a fresh check on the next browsing session — which catches
// any access revocations without burdening approved users on every
// refresh.
// ---------------------------------------------------------------------------

const APPROVAL_STORAGE_KEY = "fast:gate-approved"

function getCachedApproval(address: string): boolean {
  try {
    return sessionStorage.getItem(`${APPROVAL_STORAGE_KEY}:${address.toLowerCase()}`) === "1"
  } catch {
    return false
  }
}

function setCachedApproval(address: string): void {
  try {
    sessionStorage.setItem(`${APPROVAL_STORAGE_KEY}:${address.toLowerCase()}`, "1")
  } catch {
    // sessionStorage disabled or quota exceeded — degrade silently;
    // the user just gets a fresh API check on next load.
  }
}

/**
 * Builds an initialData object for React Query when sessionStorage
 * already confirms the user is approved. This lets the query resolve
 * synchronously on mount (no loading state, no skeleton) and skips
 * the network call entirely for the rest of the session.
 */
function buildApprovedInitialData(): GateStatusData {
  return {
    whitelisted: true,
    approved: true,
    onWaitlist: false,
    acceptedInvite: true,
    position: null,
    total: 0,
  }
}

export function useGateStatus() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()

  // If sessionStorage already confirms approval, seed the query with
  // initialData so React Query resolves synchronously (isLoading=false
  // on the very first render) and set staleTime to Infinity so no
  // refetch is attempted for this address in this tab session.
  const isCached =
    typeof window !== "undefined" && !!address && getCachedApproval(address)

  const { data, isLoading } = useQuery({
    queryKey: [GATE_STATUS_QUERY_KEY, address],
    queryFn: () => fetchGateStatus(address!),
    enabled: Boolean(isConnected && address),
    staleTime: isCached ? Infinity : 5 * 60 * 1000,
    ...(isCached ? { initialData: buildApprovedInitialData() } : {}),
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

  // Persist approval to sessionStorage whenever a fresh API response
  // confirms it. Idempotent — safe to run on every render cycle.
  if (isPreApproved && address) {
    setCachedApproval(address)
  }

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
