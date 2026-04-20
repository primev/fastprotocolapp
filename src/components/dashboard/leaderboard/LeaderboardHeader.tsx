"use client"

// Top-of-page leaderboard header: mode toggle, title, global stats,
// and the per-user performance cards for miles and volume modes.
// Split out so the LeaderboardTable parent becomes pure orchestration.

import { TrendingUp, Zap } from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { FEATURE_FLAGS } from "@/lib/config/feature-flags"
import type { FuulMilesEntry } from "@/hooks/use-fuul-miles-leaderboard"

export type LeaderboardMode = "volume" | "miles" | "stats"

export interface LeaderboardHeaderProps {
  leaderboardMode: LeaderboardMode
  onModeChange: (mode: LeaderboardMode) => void
  activeTraders: number | null
  swapVolumeEth: number | null
  totalVol: number | null
  totalParticipants: number
  totalMiles: number
  formatVolumeDisplay: (v: number) => string
  userAddr: string | undefined
  userMilesEntry: FuulMilesEntry | null
  nextMilesRankEntry: FuulMilesEntry | null
  adjustedUserPos: number | null
  adjustedUserVol: number | null
  userSwapCount: number | null
}

export const LeaderboardHeader = ({
  leaderboardMode,
  onModeChange,
  activeTraders,
  swapVolumeEth,
  totalVol,
  totalParticipants,
  totalMiles,
  formatVolumeDisplay,
  userAddr,
  userMilesEntry,
  nextMilesRankEntry,
  adjustedUserPos,
  adjustedUserVol,
  userSwapCount,
}: LeaderboardHeaderProps) => {
  return (
    <div className="flex flex-col gap-5 border-b border-white/5 pb-6">
      {/* Branding & Global Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-full p-0.5">
              {FEATURE_FLAGS.show_miles_estimate && (
                <button
                  onClick={() => onModeChange("miles")}
                  className={`px-3.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full transition-all ${
                    leaderboardMode === "miles"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground/50 hover:text-muted-foreground/80"
                  }`}
                >
                  Miles
                </button>
              )}
              <button
                onClick={() => onModeChange("volume")}
                className={`px-3.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full transition-all ${
                  leaderboardMode === "volume"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground/50 hover:text-muted-foreground/80"
                }`}
              >
                Volume
              </button>
              <button
                onClick={() => onModeChange("stats")}
                className={`px-3.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full transition-all ${
                  leaderboardMode === "stats"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground/50 hover:text-muted-foreground/80"
                }`}
              >
                Stats
              </button>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter italic leading-none whitespace-nowrap">
            LEADERBOARD
          </h1>
        </div>

        {leaderboardMode === "volume" ? (
          <div className="flex flex-col items-start lg:items-end gap-3">
            <div className="flex items-center gap-4 sm:gap-6 md:gap-10">
              <div className="flex flex-col items-start md:items-end">
                <span className="text-[7px] sm:text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.18em] sm:tracking-[0.2em]">
                  Traders
                </span>
                <span className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums tracking-tighter">
                  {activeTraders?.toLocaleString() || "---"}
                </span>
              </div>
              <div className="flex flex-col items-start md:items-end md:border-l md:border-white/10 md:pl-6 sm:pl-10">
                <span className="text-[7px] sm:text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.18em] sm:tracking-[0.2em]">
                  Vol (ETH)
                </span>
                <span className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums tracking-tighter">
                  {swapVolumeEth != null ? `${formatNumber(swapVolumeEth)} ETH` : "---"}
                </span>
              </div>
              <div className="flex flex-col items-start md:items-end md:border-l md:border-white/10 md:pl-6 sm:pl-10">
                <span className="text-[7px] sm:text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.18em] sm:tracking-[0.2em]">
                  Vol (USD)
                </span>
                <span className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums tracking-tighter">
                  {totalVol ? formatVolumeDisplay(totalVol) : "---"}
                </span>
              </div>
            </div>
          </div>
        ) : leaderboardMode === "miles" ? (
          <div className="flex items-center gap-4 sm:gap-6 md:gap-10">
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[7px] sm:text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.18em] sm:tracking-[0.2em]">
                Participants
              </span>
              <span className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums tracking-tighter">
                {totalParticipants > 0 ? totalParticipants.toLocaleString() : "---"}
              </span>
            </div>
            <div className="flex flex-col items-start md:items-end md:border-l md:border-white/10 md:pl-6 sm:pl-10">
              <span className="text-[7px] sm:text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.18em] sm:tracking-[0.2em]">
                Total Miles
              </span>
              <span className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums tracking-tighter">
                {totalMiles > 0 ? totalMiles.toLocaleString() : "---"}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* User Performance Metrics — Miles mode (hidden on stats) */}
      {leaderboardMode === "miles" && userAddr && (
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {/* Rank Card */}
          <div className="flex-1 flex items-center justify-between px-5 py-3 rounded-2xl bg-primary/[0.03] border border-primary/20 backdrop-blur-sm group hover:bg-primary/[0.05] transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shadow-inner">
                <TrendingUp size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">
                  Miles Rank
                </span>
                <span className="text-2xl font-black tabular-nums leading-none text-primary">
                  #{userMilesEntry?.rank || "--"}
                </span>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-[9px] font-bold text-muted-foreground/40 leading-tight">
                {userMilesEntry && userMilesEntry.rank === 1 ? (
                  <span className="text-primary/80">You're leading the pack!</span>
                ) : nextMilesRankEntry ? (
                  <>
                    Overtake{" "}
                    <span className="text-primary/80">#{(userMilesEntry?.rank ?? 0) - 1}</span> with{" "}
                    <span className="text-primary/80">
                      {(nextMilesRankEntry.points - (userMilesEntry?.points ?? 0)).toLocaleString()}{" "}
                      miles
                    </span>
                  </>
                ) : (
                  <span className="text-primary/80">Earn more miles to climb.</span>
                )}
              </p>
            </div>
          </div>

          {/* Miles Card */}
          <div className="flex-1 flex items-center justify-between px-5 py-3 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm group hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg text-muted-foreground shrink-0">
                <Zap size={18} className="group-hover:text-primary transition-colors" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">
                  Your Miles
                </span>
                <span className="text-2xl font-black tabular-nums leading-none">
                  {userMilesEntry?.points.toLocaleString() ?? "0"}
                </span>
              </div>
            </div>

            {FEATURE_FLAGS.show_referral_counts && (
              <div className="flex flex-col items-center sm:border-l sm:border-white/5 sm:pl-5 text-center">
                <span className="text-[8px] font-black uppercase text-muted-foreground/30 block mb-0.5">
                  Referrals
                </span>
                <p className="text-[10px] font-bold leading-none">
                  {userMilesEntry?.referrals.toLocaleString() ?? "---"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Performance Metrics (volume mode only) */}
      {leaderboardMode === "volume" && userAddr && (
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {/* Rank Card */}
          <div className="flex-1 flex items-center justify-between px-5 py-3 rounded-2xl bg-primary/[0.03] border border-primary/20 backdrop-blur-sm group hover:bg-primary/[0.05] transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shadow-inner">
                <TrendingUp size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">
                  Global Rank
                </span>
                <span className="text-2xl font-black tabular-nums leading-none text-primary">
                  #{adjustedUserPos || "--"}
                </span>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-[9px] font-bold text-muted-foreground/40 leading-tight">
                Milestone achieved. <br />
                <span className="text-primary/80">Overtake the next trader.</span>
              </p>
            </div>
          </div>

          {/* Volume Card */}
          <div className="flex-1 flex items-center justify-between px-5 py-3 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm group hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg text-muted-foreground shrink-0">
                <Zap size={18} className="group-hover:text-primary transition-colors" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">
                  Your Swap Volume
                </span>
                <span className="text-2xl font-black tabular-nums leading-none">
                  {adjustedUserVol ? formatVolumeDisplay(adjustedUserVol) : "$0.00"}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center sm:border-l sm:border-white/5 sm:pl-5 text-center">
              <span className="text-[8px] font-black uppercase text-muted-foreground/30 block mb-0.5">
                Swaps
              </span>
              <p className="text-[10px] font-bold leading-none">
                {userSwapCount !== null ? userSwapCount.toLocaleString() : "---"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
