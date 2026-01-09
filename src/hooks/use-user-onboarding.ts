import { useState, useEffect, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useUserOnboardingData } from "./use-dashboard-data"

export type UserOnboardingData = {
  connect_wallet_completed: boolean
  setup_rpc_completed: boolean
  mint_sbt_completed: boolean
  x_completed: boolean
  telegram_completed: boolean
  discord_completed: boolean
  email_completed: boolean
}

export interface UseUserOnboardingReturn {
  userOnboarding: UserOnboardingData | null
  isLoadingOnboarding: boolean
  updateUserOnboarding: (updates: Record<string, boolean>) => Promise<boolean>
  hasInitialized: boolean
}

/**
 * Hook to manage user onboarding data fetching and updates
 * Now supports React Query caching for improved performance
 */
export function useUserOnboarding(
  isConnected: boolean,
  address: string | undefined
): UseUserOnboardingReturn {
  const queryClient = useQueryClient()

  // Try to use React Query hook first (for caching benefits)
  const reactQueryData = useUserOnboardingData(isConnected && address ? address : undefined)

  const [userOnboarding, setUserOnboarding] = useState<UserOnboardingData | null>(
    reactQueryData.data?.user ?? null
  )
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(reactQueryData.isLoading)
  const [hasInitialized, setHasInitialized] = useState(
    reactQueryData.isFetched || reactQueryData.isError
  )

  // Sync React Query data to local state
  useEffect(() => {
    if (reactQueryData.data !== undefined) {
      setUserOnboarding(reactQueryData.data.user)
      setIsLoadingOnboarding(reactQueryData.isLoading)
      setHasInitialized(true)
    } else if (reactQueryData.isError) {
      setHasInitialized(true)
    }
  }, [reactQueryData.data, reactQueryData.isLoading, reactQueryData.isError])

  // Fallback: Fetch user onboarding data from API if React Query doesn't have data
  const fetchUserOnboarding = useCallback(
    async (walletAddress: string) => {
      if (!walletAddress) {
        setHasInitialized(true)
        return
      }

      // If React Query is already fetching or has data, don't duplicate
      if (reactQueryData.isLoading || reactQueryData.data !== undefined) {
        return
      }

      setIsLoadingOnboarding(true)
      try {
        const response = await fetch(`/api/user-onboarding/${walletAddress}`)
        if (response.ok) {
          const data = await response.json()
          setUserOnboarding(data.user)
          // Update React Query cache for future use
          queryClient.setQueryData(["userOnboarding", walletAddress], data)
        } else if (response.status === 404) {
          // User doesn't exist yet, that's okay
          setUserOnboarding(null)
          queryClient.setQueryData(["userOnboarding", walletAddress], { user: null })
        } else {
          console.error("Failed to fetch user onboarding:", await response.text())
        }
      } catch (error) {
        console.error("Error fetching user onboarding:", error)
      } finally {
        setIsLoadingOnboarding(false)
        setHasInitialized(true)
      }
    },
    [reactQueryData.isLoading, reactQueryData.data, queryClient]
  )

  // Update user onboarding in database
  const updateUserOnboarding = async (updates: Record<string, boolean>): Promise<boolean> => {
    if (!address) return false

    try {
      const response = await fetch(`/api/user-onboarding/${address}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setUserOnboarding(data.user)
        // Update React Query cache
        queryClient.setQueryData(["userOnboarding", address], data)
        // Invalidate to trigger refetch if needed
        queryClient.invalidateQueries({ queryKey: ["userOnboarding", address] })
        return true
      } else {
        const error = await response.json()
        console.error("Failed to update user onboarding:", error)
        return false
      }
    } catch (error) {
      console.error("Error updating user onboarding:", error)
      return false
    }
  }

  // Fetch user onboarding when wallet connects (fallback only)
  useEffect(() => {
    if (isConnected && address) {
      // Only fetch if React Query doesn't have data yet
      if (!reactQueryData.data && !reactQueryData.isLoading) {
        fetchUserOnboarding(address)
      }
    } else {
      setUserOnboarding(null)
      setHasInitialized(true) // Mark as initialized even when disconnected
    }
  }, [isConnected, address, reactQueryData.data, reactQueryData.isLoading, fetchUserOnboarding])

  return {
    userOnboarding,
    isLoadingOnboarding,
    updateUserOnboarding,
    hasInitialized,
  }
}
