"use client"

// Miles-mode standings: top-15 ranked list plus the out-of-list "Your
// Position" row and the PaginatedLeaderboardModal for the full list.
// Split out so the parent LeaderboardTable is pure mode orchestration.

import { Badge } from "@/components/ui/badge"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { FEATURE_FLAGS } from "@/lib/config/feature-flags"
import { PaginatedLeaderboardModal } from "./PaginatedLeaderboardModal"
import type { FuulMilesEntry } from "@/hooks/use-fuul-miles-leaderboard"

export interface MilesModeTableProps {
  userAddr: string | undefined
  userMilesEntry: FuulMilesEntry | null
  milesLeaderboard: FuulMilesEntry[]
  isMilesLoading: boolean
  milesModalOpen: boolean
  onMilesModalOpenChange: (open: boolean) => void
  milesModalBuildParams: (page: number, limit: number) => Record<string, string>
  milesModalFindMeParams: Record<string, string> | undefined
}

export const MilesModeTable = ({
  userAddr,
  userMilesEntry,
  milesLeaderboard,
  isMilesLoading,
  milesModalOpen,
  onMilesModalOpenChange,
  milesModalBuildParams,
  milesModalFindMeParams,
}: MilesModeTableProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end mb-1">
        <button
          onClick={() => onMilesModalOpenChange(true)}
          className="text-xs text-primary hover:underline cursor-pointer font-bold"
        >
          All Leaders &rarr;
        </button>
      </div>
      <div className="space-y-1.5 w-full">
        {isMilesLoading && milesLeaderboard.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20 animate-pulse">
            Loading miles leaderboard...
          </div>
        ) : milesLeaderboard.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20">
            No miles data available
          </div>
        ) : (
          milesLeaderboard.slice(0, 15).map((entry) => {
            const isCurrentUser = userMilesEntry?.wallet === entry.wallet
            return (
              <div
                key={entry.wallet}
                className={`relative grid grid-cols-12 items-center px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-xl border transition-all min-w-0 overflow-hidden ${
                  isCurrentUser
                    ? "bg-primary/[0.05] border-primary/30"
                    : "bg-card/20 border-white/5"
                }`}
              >
                <div className="col-span-3 sm:col-span-2 min-w-0 flex items-center gap-4">
                  <span
                    className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-[calc(-0.05em)] leading-none tabular-nums ${
                      entry.rank === 1
                        ? "text-white scale-110 origin-left"
                        : entry.rank === 2
                          ? "text-white/80"
                          : entry.rank === 3
                            ? "text-white/60"
                            : "text-muted-foreground/10"
                    }`}
                  >
                    {entry.rank.toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="col-span-5 sm:col-span-5 flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-sm sm:text-base md:text-lg truncate">
                      {entry.wallet}
                    </span>
                    {FEATURE_FLAGS.show_referral_counts && (
                      <span className="text-[10px] sm:text-xs text-muted-foreground/60 font-mono">
                        {entry.referrals.toLocaleString()} referral
                        {entry.referrals !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {isCurrentUser && (
                    <Badge className="bg-primary text-[9px] sm:text-[10px] h-4 sm:h-5 px-1.5 sm:px-2 font-black shrink-0">
                      YOU
                    </Badge>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-5 text-right min-w-0">
                  <div className="flex flex-col items-end justify-center">
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/30 mb-0.5">
                      Miles
                    </span>
                    <span className="text-xl md:text-3xl font-black tracking-tighter tabular-nums leading-none">
                      {entry.points.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* User position if not in top 15 (or not in data at all) */}
      {userAddr && (!userMilesEntry || userMilesEntry.rank > 15) && (
        <div className="mt-6">
          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">
              Your Position
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>
          <div className="relative grid grid-cols-12 items-center px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-xl border bg-primary/[0.05] border-primary/30 min-w-0 overflow-hidden">
            <div className="col-span-3 sm:col-span-2 min-w-0">
              <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[calc(-0.05em)] leading-none tabular-nums text-muted-foreground/10">
                {userMilesEntry ? userMilesEntry.rank.toString().padStart(2, "0") : "--"}
              </span>
            </div>
            <div className="col-span-5 sm:col-span-5 flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-sm sm:text-base md:text-lg truncate">
                  {userMilesEntry?.wallet ?? trimWalletAddress(userAddr.toLowerCase())}
                </span>
                {FEATURE_FLAGS.show_referral_counts && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground/60 font-mono">
                    {userMilesEntry
                      ? `${userMilesEntry.referrals.toLocaleString()} referral${userMilesEntry.referrals !== 1 ? "s" : ""}`
                      : "0 referrals"}
                  </span>
                )}
              </div>
              <Badge className="bg-primary text-[9px] sm:text-[10px] h-4 sm:h-5 px-1.5 sm:px-2 font-black shrink-0">
                YOU
              </Badge>
            </div>
            <div className="col-span-4 sm:col-span-5 text-right min-w-0">
              <div className="flex flex-col items-end justify-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/30 mb-0.5">
                  Miles
                </span>
                <span className="text-xl md:text-3xl font-black tracking-tighter tabular-nums leading-none">
                  {userMilesEntry?.points.toLocaleString() ?? "0"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <PaginatedLeaderboardModal
        open={milesModalOpen}
        onOpenChange={onMilesModalOpenChange}
        title="Miles Leaders"
        description="All wallets sorted by miles earned"
        fetchUrl="/api/fuul/leaderboard"
        buildParams={milesModalBuildParams}
        renderStat={(e) => `${Number((e as any).points ?? 0).toLocaleString()} miles`}
        renderSubtext={
          FEATURE_FLAGS.show_referral_counts
            ? (e) => `${Number((e as any).referrals ?? 0)} referrals`
            : undefined
        }
        userWallet={userAddr}
        findMeParams={milesModalFindMeParams}
        findMeUrl="/api/fuul/leaderboard/find-me"
      />
    </div>
  )
}
