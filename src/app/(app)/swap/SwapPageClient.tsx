"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { useTokenList } from "@/hooks/use-token-list"
import { usePrefetchDashboard } from "@/hooks/use-prefetch-dashboard"
import { Badge } from "@/components/ui/badge"
import type { Token } from "@/types/swap"
import SwapInterface from "@/components/swap/SwapInterface"

interface SwapPageClientProps {
  preloadedTokenList: Token[]
}

export function SwapPageClient({ preloadedTokenList }: SwapPageClientProps) {
  const [isMounted, setIsMounted] = useState(false)
  const queryClient = useQueryClient()
  const { address } = useAccount()

  // Prefetch dashboard data for faster navigation back to dashboard
  const { prefetch: prefetchDashboard } = usePrefetchDashboard()

  // Prepare initial data for React Query hydration
  const initialTokenList = preloadedTokenList.length > 0 ? preloadedTokenList : undefined

  // Fetch token list using React Query with SSR hydration
  const {
    data: tokenList,
    isLoading: isTokenListLoading,
    isFetching: isTokenListFetching,
  } = useTokenList(initialTokenList)

  // Set mounted immediately to prevent black screen
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prefetch dashboard data when swap page loads (debounced to avoid lag)
  useEffect(() => {
    if (isMounted) {
      // Delay prefetch to avoid blocking initial render
      const timeoutId = setTimeout(() => {
        prefetchDashboard(address)
      }, 500) // Wait 500ms after mount before prefetching
      return () => clearTimeout(timeoutId)
    }
  }, [isMounted, address, prefetchDashboard])

  // Only show loading if we have NO data at all (should be rare with SSR)
  // Don't show loading during background refetches - we have placeholderData for that
  const hasAnyData = tokenList || preloadedTokenList.length > 0
  const isLoading = isTokenListLoading && !hasAnyData
  const isFetching = isTokenListFetching

  // Layout provides header and paddingTop - content area needs no additional top padding
  return (
    <div className="w-full container mx-auto px-0 sm:px-0 pb-2 md:pb-4 overflow-x-hidden relative">
      {/* Show subtle indicator for background refresh - only if we have data */}
      {isFetching && hasAnyData && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2">
          <Badge variant="secondary" className="text-xs">
            Refreshing...
          </Badge>
        </div>
      )}
      <div className="w-full max-w-[480px] mx-auto pt-8 px-4">
        <SwapInterface tokens={tokenList || preloadedTokenList} isLoading={isLoading} />
      </div>
    </div>
  )
}
