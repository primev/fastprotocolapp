"use client"

// Single row in the dashboard's headline volume leaderboard. Extracted so
// the row's tier-accent, miles cell, and rank styling can be iterated on
// without reloading the 2k-line LeaderboardTable parent in context.

import { Badge } from "@/components/ui/badge"
import { Zap } from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { getTierFromVolume, getTierMetadata } from "@/lib/config/constants"
import type { LeaderboardEntry } from "./types"

export interface LeaderboardRowProps {
  entry: LeaderboardEntry
  formatVolumeDisplay: (v: number) => string
  showYouBadge?: boolean
  miles?: number | null
}

export const LeaderboardRow = ({
  entry,
  formatVolumeDisplay,
  showYouBadge,
  miles,
}: LeaderboardRowProps) => {
  const entryTier = getTierFromVolume(entry.swapVolume24h)
  const tierMeta = getTierMetadata(entryTier)
  return (
    <div
      className={`relative grid grid-cols-12 items-center px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-xl border transition-all min-w-0 overflow-hidden ${
        entry.isCurrentUser ? "bg-primary/[0.05] border-primary/30" : "bg-card/20 border-white/5"
      }`}
    >
      <div className="col-span-4 sm:col-span-3 min-w-0 flex items-center gap-4 relative group/rank">
        {entry.rank <= 3 &&
          (() => {
            const tierColorClasses = {
              gold: {
                accent: "bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]",
                bloom: "from-yellow-500/30",
              },
              silver: {
                accent: "bg-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.3)]",
                bloom: "from-slate-400/20",
              },
              bronze: {
                accent: "bg-amber-700 shadow-[0_0_15px_rgba(180,83,9,0.2)]",
                bloom: "from-amber-800/20",
              },
              standard: { accent: "", bloom: "" },
            }
            const tierColors =
              tierColorClasses[entryTier as keyof typeof tierColorClasses] ||
              tierColorClasses.standard

            return (
              <>
                <div
                  className={`absolute left-[-1.5rem] top-1/2 -translate-y-1/2 w-[3px] h-10 rounded-full blur-[1px] transition-all duration-500 group-hover/rank:h-12 ${tierColors.accent}`}
                />
                <div
                  className={`absolute inset-0 -left-6 w-24 h-full bg-gradient-to-r to-transparent -z-10 opacity-20 pointer-events-none transition-opacity duration-700 group-hover/rank:opacity-40 ${tierColors.bloom}`}
                />
              </>
            )
          })()}

        <div className="relative flex flex-col justify-center items-center">
          <span
            className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-[calc(-0.05em)] leading-none tabular-nums transition-all duration-500 ${
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

          {entry.rank <= 3 && (
            <div className="flex flex-col items-center">
              <span
                className={`text-[8px] font-bold uppercase tracking-[0.3em] mt-1 transition-colors ${
                  entryTier === "gold"
                    ? "text-yellow-500/80"
                    : entryTier === "silver"
                      ? "text-slate-400/80"
                      : entryTier === "bronze"
                        ? "text-amber-600/80"
                        : ""
                }`}
              >
                {tierMeta.label}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="col-span-5 sm:col-span-4 flex items-center gap-1.5 sm:gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="font-mono text-sm sm:text-base md:text-lg truncate">{entry.wallet}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground/60 font-mono">
            {entry.swapCount !== undefined && entry.swapCount !== null
              ? `${entry.swapCount.toLocaleString()} swap${entry.swapCount !== 1 ? "s" : ""}`
              : "N/A"}
          </span>
        </div>
        {(entry.isCurrentUser || showYouBadge) && (
          <Badge className="bg-primary text-[9px] sm:text-[10px] h-4 sm:h-5 px-1.5 sm:px-2 font-black shrink-0">
            YOU
          </Badge>
        )}
      </div>
      <div className="hidden sm:flex col-span-2 justify-end items-center min-w-0">
        <div className="flex items-center gap-1.5">
          <Zap size={11} strokeWidth={2.5} className="text-primary/60" />
          <span className="text-sm font-bold tabular-nums text-primary/80">
            {(miles ?? 0).toLocaleString()}
          </span>
          <span className="text-[9px] font-bold uppercase text-muted-foreground/40">Miles</span>
        </div>
      </div>
      <div className="col-span-3 sm:col-span-3 text-right min-w-0">
        <div className="col-span-4 flex flex-col items-end justify-center min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-white/5 ${
                entry.change24h >= 0 ? "text-emerald-500/80" : "text-rose-500/80"
              }`}
            >
              {entry.change24h >= 0 ? "↑" : "↓"} {Math.abs(entry.change24h).toFixed(1)}%
            </div>
          </div>
          <span className="text-xl md:text-3xl font-black tracking-tighter tabular-nums leading-none">
            {formatVolumeDisplay(entry.swapVolume24h)}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-bold text-primary tabular-nums">
              {formatNumber(entry.ethValue)} ETH
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
