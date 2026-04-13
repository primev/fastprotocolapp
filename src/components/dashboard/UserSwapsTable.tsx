"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserSwaps } from "@/hooks/use-user-swaps"
import { SwapsTableBody } from "./user-swaps-parts"
import { UserSwapsModal } from "./UserSwapsModal"

type Props = {
  address: string | undefined
  isConnected: boolean
}

/**
 * Cap for the inline dashboard view. The full history lives behind the
 * "Show all" button via {@link UserSwapsModal}, which paginates all rows.
 */
const RECENT_LIMIT = 5

/**
 * Dashboard card showing the user's 5 most recent FastSwap transactions
 * with per-swap miles status. A "Show all" button opens {@link UserSwapsModal}
 * for the full paginated history. Polling in `useUserSwaps` keeps pending
 * rows updating live without a page refresh.
 */
export function UserSwapsTable({ address, isConnected }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // This component is loaded via next/dynamic with ssr: false, so it only
  // ever runs on the client. No mounted guard needed — wagmi state is
  // immediately available and there's no server HTML to mismatch.
  const { swaps, isLoading, error } = useUserSwaps(address, {
    page: 1,
    pageSize: RECENT_LIMIT,
  })

  return (
    <>
      <Card className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-semibold">Your Fast Swaps</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Your {RECENT_LIMIT} most recent swaps with per-transaction miles and status.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isLoading && swaps.length > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {!isConnected ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Connect your wallet to see your Fast Swaps.
          </div>
        ) : error && swaps.length === 0 ? (
          <div className="py-8 text-center text-sm text-destructive">
            Failed to load swaps: {error}
          </div>
        ) : isLoading && swaps.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : swaps.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No Fast Swaps yet. Make your first swap to start earning miles.
          </div>
        ) : (
          <>
            <SwapsTableBody swaps={swaps} />
            <div className="flex justify-center pt-4 mt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Show all swaps
              </button>
            </div>
          </>
        )}
      </Card>

      {isConnected && address ? (
        <UserSwapsModal open={isModalOpen} onOpenChange={setIsModalOpen} address={address} />
      ) : null}
    </>
  )
}
