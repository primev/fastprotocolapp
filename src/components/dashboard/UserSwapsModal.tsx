"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserSwaps } from "@/hooks/use-user-swaps"
import { SwapsTableBody } from "./user-swaps-parts"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
}

/**
 * Page size inside the modal. Matches the leaderboard "Show all" modal
 * cadence so users feel consistent pagination across the app.
 */
const MODAL_PAGE_SIZE = 25

/**
 * Build page number array with ellipsis: [1, '...', 4, 5, 6, '...', 20].
 * Copied from the leaderboard's PaginatedLeaderboardModal so the two
 * pagination UIs render identically. Kept local to avoid depending on
 * leaderboard internals.
 */
function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "...")[] = []
  pages.push(1)
  if (current > 3) pages.push("...")
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push("...")
  pages.push(total)
  return pages
}

/**
 * Full-history modal for a user's FastSwap transactions. Opens from the
 * "Show all swaps" button on the inline dashboard card. Uses the same
 * pagination pattern as the leaderboard's PaginatedLeaderboardModal so the
 * two "show all" experiences are consistent.
 *
 * The hook only fires when `open === true` because Radix's DialogPortal
 * doesn't mount content until open, so polling and fetches are cleanly
 * scoped to the lifetime of the modal.
 */
export function UserSwapsModal({ open, onOpenChange, address }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>All your Fast Swaps</DialogTitle>
          <DialogDescription>
            Full transaction history with per-swap miles and status.
          </DialogDescription>
        </DialogHeader>
        <UserSwapsModalBody address={address} />
      </DialogContent>
    </Dialog>
  )
}

/**
 * Inner component that actually fetches & renders. Split out so the hook
 * (and its polling) only mounts when the dialog is open — Radix portals
 * the content conditionally, which unmounts this subtree on close.
 */
function UserSwapsModalBody({ address }: { address: string }) {
  const [page, setPage] = useState(1)
  const { swaps, pagination, isLoading, error } = useUserSwaps(address, {
    page,
    pageSize: MODAL_PAGE_SIZE,
  })

  const { totalPages, total } = pagination

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between pb-2">
        <p className="text-xs text-muted-foreground">
          {total > 0 ? `${total.toLocaleString()} swaps` : ""}
        </p>
        {isLoading && swaps.length > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {/*
       * Scrollable body — scrollbar hidden cross-browser:
       *   - `scrollbarWidth: "none"` hides it in Firefox
       *   - `msOverflowStyle: "none"` hides it in legacy Edge/IE
       *   - `[&::-webkit-scrollbar]:hidden` hides it in Chromium/Safari
       * Scrolling still works; just no visible track or thumb.
       */}
      <div
        className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {error && swaps.length === 0 ? (
          <div className="py-12 text-center text-sm text-destructive">
            Failed to load swaps: {error}
          </div>
        ) : isLoading && swaps.length === 0 ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : swaps.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No Fast Swaps yet. Make your first swap to start earning miles.
          </div>
        ) : (
          <SwapsTableBody swaps={swaps} />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-3 border-t border-white/5 mt-2">
          {/* First */}
          <button
            onClick={() => setPage(1)}
            disabled={page <= 1 || isLoading}
            aria-label="First page"
            className="px-2 py-1.5 text-xs font-bold rounded-md bg-white/[0.03] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsLeft size={14} />
          </button>
          {/* Prev */}
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            aria-label="Previous page"
            className="px-2 py-1.5 text-xs font-bold rounded-md bg-white/[0.03] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {/* Page numbers */}
          {buildPageNumbers(page, totalPages).map((p, i) =>
            p === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="px-1 text-xs text-muted-foreground/30 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p as number)}
                disabled={isLoading}
                className={`min-w-[28px] px-1.5 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.03] text-muted-foreground hover:text-foreground"
                } disabled:cursor-not-allowed`}
              >
                {p}
              </button>
            )
          )}
          {/* Next */}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            aria-label="Next page"
            className="px-2 py-1.5 text-xs font-bold rounded-md bg-white/[0.03] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
          {/* Last */}
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || isLoading}
            aria-label="Last page"
            className="px-2 py-1.5 text-xs font-bold rounded-md bg-white/[0.03] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
