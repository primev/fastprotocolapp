"use client"

// Volume-mode standings: tier filter, top-15 rows, "Your Position"
// fallback row for filtered views, and the PaginatedLeaderboardModal.
// Split from LeaderboardTable to keep tier-filter UX colocated.

import { Fragment } from "react"
import { Card } from "@/components/ui/card"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { LeaderboardRow } from "./LeaderboardRow"
import { PaginatedLeaderboardModal } from "./PaginatedLeaderboardModal"
import type { LeaderboardEntry } from "./types"

export interface VolumeModeTableProps {
  userAddr: string | undefined
  lbData: LeaderboardEntry[]
  filteredLbData: LeaderboardEntry[]
  milesByWallet: Map<string, number>
  tierFilter: string
  onTierFilterChange: (tier: string) => void
  adjustedUserPos: number | null
  adjustedUserVol: number | null
  userSwapCount: number | null
  volumeModalOpen: boolean
  onVolumeModalOpenChange: (open: boolean) => void
  volumeModalBuildParams: (page: number, limit: number) => Record<string, string>
  volumeModalFindMeParams: Record<string, string> | undefined
  formatVolumeDisplay: (v: number) => string
  isLoadingProp: boolean
}

export const VolumeModeTable = ({
  userAddr,
  lbData,
  filteredLbData,
  milesByWallet,
  tierFilter,
  onTierFilterChange,
  adjustedUserPos,
  adjustedUserVol,
  userSwapCount,
  volumeModalOpen,
  onVolumeModalOpenChange,
  volumeModalBuildParams,
  volumeModalFindMeParams,
  formatVolumeDisplay,
  isLoadingProp,
}: VolumeModeTableProps) => {
  return (
    <div className="space-y-4">
      {/* Standings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => onTierFilterChange("all")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                tierFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/[0.03] text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => onTierFilterChange("gold")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 ${
                tierFilter === "gold"
                  ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50"
                  : "bg-white/[0.03] text-muted-foreground hover:text-yellow-500"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              Gold
            </button>
            <button
              onClick={() => onTierFilterChange("silver")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 ${
                tierFilter === "silver"
                  ? "bg-slate-400/20 text-slate-300 border border-slate-400/50"
                  : "bg-white/[0.03] text-muted-foreground hover:text-slate-300"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Silver
            </button>
            <button
              onClick={() => onTierFilterChange("bronze")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 ${
                tierFilter === "bronze"
                  ? "bg-amber-600/20 text-amber-600 border border-amber-600/50"
                  : "bg-white/[0.03] text-muted-foreground hover:text-amber-600"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              Bronze
            </button>
          </div>
          <button
            onClick={() => onVolumeModalOpenChange(true)}
            className="text-xs text-primary hover:underline cursor-pointer font-bold"
          >
            {tierFilter === "all"
              ? "All Leaders"
              : `All ${tierFilter.charAt(0).toUpperCase() + tierFilter.slice(1)} Leaders`}{" "}
            &rarr;
          </button>
        </div>
        <div className="space-y-1.5 w-full">
          {isLoadingProp && lbData.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20 animate-pulse">
              Loading leaderboard...
            </div>
          ) : lbData.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20">
              No leaderboard data available
            </div>
          ) : filteredLbData.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground bg-card/20 border-white/5">
              No traders in this tier yet
            </Card>
          ) : (
            filteredLbData.map((entry, index) => {
              const shouldShowDivider =
                tierFilter === "all" &&
                adjustedUserPos &&
                adjustedUserPos > 15 &&
                entry.isCurrentUser &&
                index === 15
              return (
                <Fragment key={entry.wallet}>
                  {shouldShowDivider && (
                    <div className="flex items-center gap-4 py-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">
                        Your Position
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    </div>
                  )}
                  <LeaderboardRow
                    entry={entry}
                    formatVolumeDisplay={formatVolumeDisplay}
                    miles={milesByWallet.get(entry.wallet) ?? null}
                  />
                </Fragment>
              )
            })
          )}
        </div>

        {/* Your Position - show when filtering by tier and user is not visible */}
        {tierFilter !== "all" && userAddr && adjustedUserVol !== null && (
          <div className="mt-6">
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">
                Your Position
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </div>
            <LeaderboardRow
              entry={{
                wallet: trimWalletAddress(userAddr.toLowerCase()),
                rank: adjustedUserPos || 0,
                swapVolume24h: adjustedUserVol,
                swapCount: userSwapCount ?? undefined,
                change24h: 0,
                isCurrentUser: true,
                ethValue: undefined,
              }}
              formatVolumeDisplay={formatVolumeDisplay}
              showYouBadge
              miles={
                userAddr
                  ? (milesByWallet.get(trimWalletAddress(userAddr.toLowerCase())) ?? null)
                  : null
              }
            />
          </div>
        )}
      </div>

      <PaginatedLeaderboardModal
        open={volumeModalOpen}
        onOpenChange={onVolumeModalOpenChange}
        title={
          tierFilter === "all"
            ? "Volume Leaders"
            : `${tierFilter.charAt(0).toUpperCase() + tierFilter.slice(1)} Volume Leaders`
        }
        description={
          tierFilter === "all"
            ? "All wallets sorted by swap volume"
            : `${tierFilter.charAt(0).toUpperCase() + tierFilter.slice(1)} tier wallets sorted by swap volume`
        }
        fetchUrl="/api/analytics/leaderboard/volume-leaders"
        buildParams={volumeModalBuildParams}
        renderStat={(e) => formatVolumeDisplay(Number((e as any).volume ?? 0))}
        renderSubtext={(e) => `${Number((e as any).swapCount ?? 0)} swaps`}
        userWallet={userAddr}
        findMeParams={volumeModalFindMeParams}
        tierAccent={
          tierFilter === "gold"
            ? {
                label: "Gold",
                dot: "bg-yellow-500",
                gradient: "via-yellow-500/50",
                border: "border-yellow-500/20",
              }
            : tierFilter === "silver"
              ? {
                  label: "Silver",
                  dot: "bg-slate-400",
                  gradient: "via-slate-400/50",
                  border: "border-slate-400/20",
                }
              : tierFilter === "bronze"
                ? {
                    label: "Bronze",
                    dot: "bg-amber-600",
                    gradient: "via-amber-600/50",
                    border: "border-amber-600/20",
                  }
                : null
        }
      />
    </div>
  )
}
