"use client"

// Generic paginated "All Leaders" modal reused by every leaderboard card
// (volume, efficiency, referrals, rising stars). Extracted so one shared
// pagination + Find-Me UX lives in a single file rather than being buried
// in the multi-thousand-line LeaderboardTable.

import { useCallback, useEffect, useRef, useState } from "react"
import type React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Compass } from "lucide-react"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { LEADERBOARD_PAGE_SIZE as PAGE_SIZE, buildPageNumbers } from "./paginate"

export interface PaginatedModalEntry {
  rank: number
  wallet: string
  [key: string]: unknown
}

export interface PaginatedLeaderboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  fetchUrl: string // Base URL for API calls
  buildParams: (page: number, limit: number) => Record<string, string> // Query params builder
  renderStat: (entry: PaginatedModalEntry) => React.ReactNode
  renderSubtext?: (entry: PaginatedModalEntry) => React.ReactNode
  userWallet?: string
  findMeParams?: Record<string, string> // Extra params for find-me API
  findMeUrl?: string // Override find-me endpoint (default: /api/analytics/leaderboard/find-me)
  tierAccent?: { label: string; dot: string; gradient: string; border: string } | null // Tier color accent for modal
}

export const PaginatedLeaderboardModal = ({
  open,
  onOpenChange,
  title,
  description,
  fetchUrl,
  buildParams,
  renderStat,
  renderSubtext,
  userWallet,
  findMeParams,
  findMeUrl,
  tierAccent,
}: PaginatedLeaderboardModalProps) => {
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<PaginatedModalEntry[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightWallet, setHighlightWallet] = useState<string | null>(null)
  const [findMeLoading, setFindMeLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const highlightRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(
    async (p: number) => {
      setIsLoading(true)
      try {
        const params = buildParams(p, PAGE_SIZE)
        const qs = new URLSearchParams(params).toString()
        const res = await fetch(`${fetchUrl}?${qs}`)
        if (!res.ok) return
        const json = await res.json()
        setEntries(json.entries || [])
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 0)
          setTotal(json.pagination.total || 0)
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    },
    [fetchUrl, buildParams]
  )

  // Track whether the page change was triggered by Find Me
  const findMeTriggeredRef = useRef(false)

  // Fetch when page changes or modal opens
  useEffect(() => {
    if (open) {
      fetchPage(page)
      // Clear highlight only when navigating pages manually (not from Find Me)
      if (!findMeTriggeredRef.current) {
        setHighlightWallet(null)
      }
      findMeTriggeredRef.current = false
    }
  }, [open, page, fetchPage])

  // Scroll highlighted row into view after entries load
  useEffect(() => {
    if (highlightWallet && entries.length > 0 && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightWallet, entries])

  // Reset page when modal closes
  useEffect(() => {
    if (!open) {
      setPage(1)
      setEntries([])
      setHighlightWallet(null)
      setNotFound(false)
    }
  }, [open])

  const handleFindMe = useCallback(async () => {
    if (!userWallet || !findMeParams) return
    setFindMeLoading(true)
    setNotFound(false)
    try {
      const params = new URLSearchParams({
        wallet: userWallet,
        pageSize: String(PAGE_SIZE),
        ...findMeParams,
      })
      const baseUrl = findMeUrl || "/api/analytics/leaderboard/find-me"
      const res = await fetch(`${baseUrl}?${params}`)
      if (!res.ok) return
      const json = await res.json()
      if (json.found) {
        findMeTriggeredRef.current = true
        setHighlightWallet(trimWalletAddress(userWallet.toLowerCase()))
        setPage(json.page)
      } else {
        setNotFound(true)
      }
    } catch {
      // silently fail
    } finally {
      setFindMeLoading(false)
    }
  }, [userWallet, findMeParams, findMeUrl])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-2xl max-h-[85vh] bg-background flex flex-col ${tierAccent ? tierAccent.border : "border-white/10"}`}
      >
        {tierAccent && (
          <div
            className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${tierAccent.gradient} to-transparent`}
          />
        )}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                {tierAccent && <span className={`w-2 h-2 rounded-full ${tierAccent.dot}`} />}
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/60">
                {description} {total > 0 && `· ${total.toLocaleString()} total`}
              </DialogDescription>
            </div>
            {userWallet && findMeParams && (
              <button
                onClick={handleFindMe}
                disabled={findMeLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <Compass size={14} className={findMeLoading ? "animate-spin" : ""} />
                Find Me
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1 min-h-[60vh]">
          {notFound ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="p-3 rounded-full bg-white/[0.03]">
                <Compass size={28} className="text-muted-foreground/20" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-foreground/80">
                  You're not on this leaderboard yet
                </p>
                <p className="text-xs text-muted-foreground/40">
                  Keep trading to earn your spot among the leaders.
                </p>
              </div>
              <button
                onClick={() => setNotFound(false)}
                className="px-4 py-2 text-xs font-bold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                View Leaderboard
              </button>
            </div>
          ) : entries.length === 0 && isLoading ? (
            <div className="p-8 text-center text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
              Loading...
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground/30">No results found</div>
          ) : (
            <div
              className={`transition-opacity duration-150 ${isLoading ? "opacity-40 pointer-events-none" : ""}`}
            >
              {entries.map((entry, idx) => {
                const isHighlighted = highlightWallet && entry.wallet === highlightWallet
                return (
                  <div
                    key={entry.wallet}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={`flex items-center justify-between py-2 px-3 rounded text-sm transition-all ${
                      isHighlighted
                        ? "bg-primary/10 ring-1 ring-primary/40"
                        : idx === 0 && page === 1
                          ? "bg-primary/[0.05]"
                          : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground/40 w-8 text-xs font-mono text-right">
                        {entry.rank}.
                      </span>
                      <span className="font-mono text-sm truncate max-w-[200px]">
                        {entry.wallet}
                      </span>
                      {isHighlighted && (
                        <Badge className="bg-primary text-[9px] h-4 px-1.5 font-black">YOU</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {renderSubtext && (
                        <span className="text-[10px] text-muted-foreground/40 font-mono">
                          {renderSubtext(entry)}
                        </span>
                      )}
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          isHighlighted
                            ? "text-primary"
                            : idx === 0 && page === 1
                              ? "bg-primary text-primary-foreground px-2 py-0.5 rounded"
                              : ""
                        }`}
                      >
                        {renderStat(entry)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && !notFound && (
          <div className="flex items-center justify-center gap-1 pt-3 border-t border-white/5">
            {/* First */}
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || isLoading}
              className="px-2 py-1.5 text-xs font-bold rounded-md bg-white/[0.03] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft size={14} />
            </button>
            {/* Prev */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
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
              className="px-2 py-1.5 text-xs font-bold rounded-md bg-white/[0.03] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
            {/* Last */}
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isLoading}
              className="px-2 py-1.5 text-xs font-bold rounded-md bg-white/[0.03] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
