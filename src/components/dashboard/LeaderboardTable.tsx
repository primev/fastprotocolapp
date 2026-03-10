"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { TrendingUp, Target, Zap, Users, Flame, HelpCircle, BarChart3 } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import {
  TIER_THRESHOLDS,
  getTierFromVolume,
  getTierMetadata,
  getNextTier,
  TESTING_VOLUME_MULTIPLIER,
} from "@/lib/constants"

interface LeaderboardEntry {
  wallet: string
  rank: number
  swapVolume24h: number
  swapCount?: number
  change24h: number
  isCurrentUser?: boolean
  ethValue?: number
}

interface LeaderboardData {
  success: boolean
  leaderboard?: LeaderboardEntry[]
  userVolume?: number | null
  userPosition?: number | null
  nextRankVolume?: number | null
}

interface LeaderboardStats {
  activeTraders: number | null
  swapVolumeEth: number | null
  swapVolumeUsd: number | null
}

interface LeaderboardTableProps {
  address?: string
  leaderboardData?: LeaderboardData | null
  statsData?: LeaderboardStats | null
  isLoading?: boolean
  isFetching?: boolean
}

export const LeaderboardTable = ({
  address,
  leaderboardData,
  statsData,
  isLoading: isLoadingProp = false,
  isFetching: isFetchingProp = false,
}: LeaderboardTableProps) => {
  // State Management - only for data not provided by React Query
  const { address: conn } = useAccount()
  const userAddr = address || conn

  // Get data from props (React Query managed)
  const activeTraders = statsData?.activeTraders ?? null
  const swapVolumeEth = statsData?.swapVolumeEth ?? null
  const swapVolumeUsd = statsData?.swapVolumeUsd ?? null
  const lbData = leaderboardData?.leaderboard || []
  const userVol = leaderboardData?.userVolume ?? null
  const userPos = leaderboardData?.userPosition ?? null
  const nextRankVol = leaderboardData?.nextRankVolume ?? null

  const totalVol = useMemo(() => swapVolumeUsd ?? null, [swapVolumeUsd])

  // Prefetch referral leaderboard on mount (not gated by Stats tab)
  const [referralData, setReferralData] = useState<{ byPoints: ReferralLeaderEntry[]; byRefs: ReferralLeaderEntry[] } | null>(null)
  useEffect(() => {
    fetch("/api/fuul/leaderboard?limit=10")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json) setReferralData({ byPoints: json.byPoints || [], byRefs: json.byRefs || [] })
      })
      .catch(() => {})
  }, [])

  // Apply testing multiplier to user volume
  const adjustedUserVol = useMemo(
    () => (userVol ? userVol * TESTING_VOLUME_MULTIPLIER : null),
    [userVol]
  )

  // Recalculate position and leaderboard with adjusted volume
  const { adjustedLbData, adjustedUserPos, adjustedNextRankVol } = useMemo(() => {
    if (!adjustedUserVol || !lbData.length) {
      return { adjustedLbData: lbData, adjustedUserPos: userPos, adjustedNextRankVol: nextRankVol }
    }

    // Create adjusted leaderboard with user's adjusted volume
    let adjusted = lbData.map((entry) => {
      if (entry.isCurrentUser) {
        return {
          ...entry,
          swapVolume24h: adjustedUserVol,
        }
      }
      return entry
    })

    // If user is not in original leaderboard, add them with adjusted volume
    const userInOriginal = adjusted.some((e) => e.isCurrentUser)
    if (!userInOriginal && userAddr) {
      adjusted.push({
        wallet: trimWalletAddress(userAddr.toLowerCase()),
        rank: 0, // Will be recalculated
        swapVolume24h: adjustedUserVol,
        swapCount: undefined,
        change24h: 0,
        isCurrentUser: true,
        ethValue: undefined,
      })
    }

    // Sort by volume (descending) and recalculate ranks
    const sorted = [...adjusted].sort((a, b) => b.swapVolume24h - a.swapVolume24h)
    const ranked = sorted.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))

    // Find user's new position and next rank volume
    const userEntry = ranked.find((e) => e.isCurrentUser)
    const calculatedPos = userEntry ? userEntry.rank : null

    // Show top 15 entries
    const top15 = ranked.slice(0, 15)
    const userInTop15 = top15.some((e) => e.isCurrentUser)

    // If user is in top 15, use calculated position; otherwise use actual API position
    const newPos = userInTop15 && calculatedPos ? calculatedPos : userPos

    // Find next rank volume (person above user)
    let newNextRankVol = null
    if (newPos && newPos > 1) {
      if (userInTop15 && calculatedPos) {
        // User is in top 15, use ranked list
        const nextRankEntry = ranked.find((e) => e.rank === calculatedPos - 1)
        newNextRankVol = nextRankEntry ? nextRankEntry.swapVolume24h : null
      } else {
        // User is outside top 15, use API nextRankVol
        newNextRankVol = nextRankVol
      }
    }

    let displayData = top15
    if (!userInTop15 && userPos && userAddr) {
      const fromLb = lbData.find((e) => e.isCurrentUser)
      // Add user entry after top 15 with actual position from API
      displayData = [
        ...top15,
        {
          wallet: trimWalletAddress(userAddr.toLowerCase()),
          rank: userPos, // Use actual API position
          swapVolume24h: adjustedUserVol,
          swapCount: fromLb?.swapCount,
          change24h: 0,
          isCurrentUser: true,
          ethValue: fromLb?.ethValue,
        },
      ]
    }

    return {
      adjustedLbData: displayData,
      adjustedUserPos: newPos,
      adjustedNextRankVol: newNextRankVol,
    }
  }, [lbData, adjustedUserVol, userPos, nextRankVol, userAddr])

  // Derive user swap count from leaderboard data (already includes swapCount)
  const userSwapCount = useMemo(() => {
    const userEntry = lbData.find((e) => e.isCurrentUser)
    return userEntry?.swapCount ?? null
  }, [lbData])

  // Tier Calculations (using adjusted volume)
  const currentTier = useMemo(() => getTierFromVolume(adjustedUserVol), [adjustedUserVol])
  const currentTierMeta = useMemo(() => getTierMetadata(currentTier), [currentTier])
  const nextTierVal = useMemo(() => getNextTier(adjustedUserVol), [adjustedUserVol])
  const progress = useMemo(
    () => Math.min(((adjustedUserVol || 0) / nextTierVal) * 100, 100),
    [adjustedUserVol, nextTierVal]
  )
  const nextTierName = useMemo(() => {
    const vol = adjustedUserVol || 0
    if (vol < TIER_THRESHOLDS.BRONZE) return "Bronze"
    if (vol < TIER_THRESHOLDS.SILVER) return "Silver"
    return "Gold"
  }, [adjustedUserVol])
  const nextTierMeta = useMemo(() => getTierMetadata(nextTierName.toLowerCase()), [nextTierName])

  const [activeTab, setActiveTab] = useState("standings")
  const [tierFilter, setTierFilter] = useState<string>("all")

  // Formatting Helpers
  const formatVolumeDisplay = (v: number) => {
    if (v >= 1e6) return formatCurrency(v, { maximumFractionDigits: 1 })
    if (v < 100) return formatCurrency(v, { maximumFractionDigits: 2 })
    return `$${Math.floor(v).toLocaleString()}`
  }

  const formatVolDiffDisplay = (v: number) => {
    if (v >= 1e6) return formatCurrency(v, { maximumFractionDigits: 2 })
    if (v >= 1e3) return formatCurrency(v, { maximumFractionDigits: 2 })
    if (v >= 1) return formatCurrency(v, { maximumFractionDigits: 2 })
    if (v >= 0.01) return formatCurrency(v, { maximumFractionDigits: 2 })
    return `$${v.toFixed(6).replace(/\.?0+$/, "")}`
  }

  const tierBackgroundClass = useMemo(() => {
    if (currentTierMeta.color === "text-yellow-500") return "bg-yellow-500/[0.03]"
    if (currentTierMeta.color === "text-slate-400") return "bg-slate-400/[0.03]"
    if (currentTierMeta.color === "text-amber-600") return "bg-amber-600/[0.03]"
    return "bg-muted-foreground/[0.03]"
  }, [currentTierMeta.color])

  // Filter leaderboard data by tier
  const filteredLbData = useMemo(() => {
    if (tierFilter === "all") return adjustedLbData
    return adjustedLbData.filter((entry) => {
      if (entry.isCurrentUser) return false
      const entryTier = getTierFromVolume(entry.swapVolume24h)
      return entryTier === tierFilter
    })
  }, [adjustedLbData, tierFilter])

  // Stats: sorted variants for stats tab
  const statsByTxCount = useMemo(
    () => [...adjustedLbData].filter((e) => !e.isCurrentUser).sort((a, b) => (b.swapCount ?? 0) - (a.swapCount ?? 0)).slice(0, 10),
    [adjustedLbData]
  )
  const statsByVolume = useMemo(
    () => [...adjustedLbData].filter((e) => !e.isCurrentUser).sort((a, b) => b.swapVolume24h - a.swapVolume24h).slice(0, 10),
    [adjustedLbData]
  )

  return (
    <div className="w-full max-w-7xl mx-auto py-4 md:py-8 px-3 sm:px-4 md:px-6 space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Header Section: Title & Global Stats */}
      <div className="flex flex-col gap-5 border-b border-white/5 pb-6">
        {/* Branding & Global Metrics */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-col shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/70">
                Swap Volume
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter italic leading-none whitespace-nowrap">
              LEADERBOARD
            </h1>
          </div>

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

        {/* User Performance Metrics */}
        {userAddr && (
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
                  {userSwapCount !== null
                    ? userSwapCount.toLocaleString()
                    : "---"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress & Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
        {/* Progress Tracker Card */}
        <Card className="p-3 sm:p-4 bg-white/[0.01] border-white/5 flex flex-col justify-center space-y-2 sm:space-y-3 min-w-0 w-full h-full">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/40 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Target size={10} className="sm:w-3 sm:h-3 shrink-0" />{" "}
              <span className="whitespace-nowrap">Progress Tracker</span>
            </div>
            <span className="text-primary font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0">
              {progress.toFixed(1)}% to {formatVolumeDisplay(nextTierVal)}
            </span>
          </div>
          <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-primary transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between gap-1 sm:gap-2 min-w-0">
            {[
              { n: "Bronze", v: TIER_THRESHOLDS.BRONZE, c: "text-amber-600" },
              { n: "Silver", v: TIER_THRESHOLDS.SILVER, c: "text-slate-400" },
              { n: "Gold", v: TIER_THRESHOLDS.GOLD, c: "text-yellow-500" },
            ].map((t) => (
              <div key={t.n} className="flex flex-col min-w-0">
                <span className={`text-sm sm:text-base font-black ${t.c} whitespace-nowrap`}>
                  {t.n}
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-bold opacity-60 whitespace-nowrap truncate">
                  {formatVolumeDisplay(t.v)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Performance Analysis Card */}
        <Card className="overflow-hidden border-white/5 bg-white/[0.01] transition-all duration-300 hover:border-primary/20 shadow-2xl h-full flex">
          <div className="flex flex-col sm:flex-row items-stretch w-full h-full">
            {/* Analysis Content */}
            <div className="sm:w-2/3 p-4 sm:p-5 flex flex-col justify-center bg-primary/[0.01]">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center gap-2.5">
                  <TrendingUp size={15} className="text-primary/40" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/60">
                    Performance Analysis
                  </h4>
                </div>

                <p className="text-sm sm:text-base font-bold leading-snug tracking-tight text-foreground/90">
                  {!userAddr ? (
                    <span className="text-[10px] sm:text-sm text-muted-foreground/40 font-black uppercase tracking-widest italic">
                      Connect wallet to unlock rank
                    </span>
                  ) : adjustedUserPos ? (
                    adjustedUserPos === 1 ? (
                      <>
                        <span className="text-primary font-black">Congratulations!</span> You're in{" "}
                        <span className="italic font-bold text-primary">#1</span> position.
                        <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-primary/80 uppercase tracking-widest">
                          Hold that lead
                        </span>
                      </>
                    ) : (
                      <>
                        Surpass <span className="italic font-bold">#{adjustedUserPos - 1}</span>{" "}
                        with{" "}
                        <span className="text-primary font-black decoration-primary/20 tabular-nums">
                          {adjustedNextRankVol && adjustedUserVol
                            ? formatVolDiffDisplay(adjustedNextRankVol - adjustedUserVol)
                            : "--"}
                        </span>
                        {currentTier !== "gold" && (
                          <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                            Reach <span className={nextTierMeta.color}>{nextTierName}</span> in{" "}
                            {adjustedUserVol
                              ? formatVolDiffDisplay(nextTierVal - adjustedUserVol)
                              : "--"}
                          </span>
                        )}
                      </>
                    )
                  ) : (
                    <span className="text-[10px] sm:text-sm text-muted-foreground/30 font-black uppercase tracking-widest italic">
                      Network sync in progress...
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Tier Display */}
            <div
              className={`sm:w-1/3 p-4 flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-white/5 ${tierBackgroundClass}`}
            >
              <div className="flex flex-col justify-center items-center">
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mb-1.5">
                  Current Tier
                </span>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-sm sm:text-base font-black uppercase tracking-widest sm:order-1 ${currentTierMeta.color}`}
                  >
                    {currentTier === "standard" ? "Standard" : currentTierMeta.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Leaderboard Table Section with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="grid w-full max-w-[200px] grid-cols-2">
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          {/* Tier Filter - only show on standings tab */}
          {activeTab === "standings" && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setTierFilter("all")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  tierFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.03] text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTierFilter("gold")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                  tierFilter === "gold"
                    ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50"
                    : "bg-white/[0.03] text-muted-foreground hover:text-yellow-500"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Gold
              </button>
              <button
                onClick={() => setTierFilter("silver")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                  tierFilter === "silver"
                    ? "bg-slate-400/20 text-slate-300 border border-slate-400/50"
                    : "bg-white/[0.03] text-muted-foreground hover:text-slate-300"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Silver
              </button>
              <button
                onClick={() => setTierFilter("bronze")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                  tierFilter === "bronze"
                    ? "bg-amber-600/20 text-amber-600 border border-amber-600/50"
                    : "bg-white/[0.03] text-muted-foreground hover:text-amber-600"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                Bronze
              </button>
            </div>
          )}
        </div>

        {/* STANDINGS TAB */}
        <TabsContent value="standings" className="space-y-2">
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
                  tierFilter === "all" && adjustedUserPos && adjustedUserPos > 15 && entry.isCurrentUser && index === 15
                return (
                  <React.Fragment key={entry.wallet}>
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
                    />
                  </React.Fragment>
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
              />
            </div>
          )}
        </TabsContent>

        {/* STATS TAB */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Volume Leaders */}
            <VolumeLeadersCard initialData={statsByVolume} />

            {/* Efficiency Leaders */}
            <EfficiencyLeadersCard initialData={statsByTxCount} />

            {/* Referral Leaders */}
            <ReferralLeadersCard prefetchedData={referralData} />

            {/* Rising Stars */}
            <StatsCard
              title="Rising Stars"
              subtitle="joined last 30d"
              icon={<Flame size={18} className="text-orange-500" />}
              tabs={["Climbers", "New Users", "WoW Growth"]}
              entries={statsByTxCount}
              formatStat={(e) => (e.swapCount ?? 0).toLocaleString()}
              statLabel="GROWTH"
              highlightColor="text-green-500"
              tooltip={<><strong>Climbers</strong> — biggest rank improvements.<br /><strong>New Users</strong> — top performers who joined recently.<br /><strong>WoW Growth</strong> — highest week-over-week volume increase.</>}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Individual Leaderboard Row Component
interface LeaderboardRowProps {
  entry: LeaderboardEntry
  formatVolumeDisplay: (v: number) => string
  showYouBadge?: boolean
}

const LeaderboardRow = ({ entry, formatVolumeDisplay, showYouBadge }: LeaderboardRowProps) => {
  const entryTier = getTierFromVolume(entry.swapVolume24h)
  const tierMeta = getTierMetadata(entryTier)

  return (
    <div
      className={`relative grid grid-cols-12 items-center px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-xl border transition-all min-w-0 overflow-hidden ${
        entry.isCurrentUser
          ? "bg-primary/[0.05] border-primary/30"
          : "bg-card/20 border-white/5"
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
          )}
        </div>
      </div>
      <div className="col-span-5 sm:col-span-4 flex items-center gap-1.5 sm:gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="font-mono text-sm sm:text-base md:text-lg truncate">
            {entry.wallet}
          </span>
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
      <div className="hidden sm:flex col-span-2 justify-end items-center min-w-0 group/miles">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/[0.01] border border-white/[0.03]">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">
              Miles
            </span>
            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-primary/50 italic">
              Pending
            </span>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/10 blur-[6px] rounded-full" />
            <Zap
              size={13}
              strokeWidth={2.5}
              className="text-primary/70 drop-shadow-[0_0_2px_rgba(59,130,246,0.5)] relative z-10"
              fill="none"
            />
          </div>
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
              {entry.change24h >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(entry.change24h).toFixed(1)}%
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

// Stats Card Component
interface StatsCardProps {
  title: string
  subtitle?: string
  icon: React.ReactNode
  tabs: string[]
  entries: LeaderboardEntry[]
  formatStat: (entry: LeaderboardEntry) => string
  statLabel: string
  highlightColor?: string
  tooltip?: React.ReactNode
}

const StatsCard = ({
  title,
  subtitle,
  icon,
  tabs,
  entries,
  formatStat,
  statLabel,
  highlightColor = "text-foreground",
  tooltip,
}: StatsCardProps) => {
  const [activeTab, setActiveTab] = useState(tabs[0])
  const leader = entries[0]
  if (!leader) return null

  return (
    <Card className="p-4 md:p-6 bg-white/[0.01] border-white/5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-bold text-sm">{title}</h3>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground/40">({subtitle})</span>
        )}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle size={14} className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Internal tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              activeTab === tab
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {!leader ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <BarChart3 size={32} className="text-muted-foreground/15" />
          <p className="text-xs text-muted-foreground/30 font-medium">No data available yet</p>
        </div>
      ) : (
        <>
          <div className="flex gap-4">
            {/* Leader highlight */}
            <div className="flex flex-col items-center justify-center p-4 bg-white/[0.02] rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <span className="text-sm font-black uppercase tracking-widest text-primary">
                  #1
                </span>
              </div>
              <p className="font-mono text-xs text-center truncate max-w-[110px]">{leader.wallet}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mt-1">
                {statLabel}
              </p>
              <p className={`text-lg font-black tabular-nums ${highlightColor}`}>
                {formatStat(leader)}
              </p>
            </div>

            {/* Ranked list - scrollbar hidden */}
            <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
              {entries.map((entry, idx) => (
                <div
                  key={entry.wallet}
                  className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                    idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/40 w-6 text-xs font-mono">{idx + 1}.</span>
                    <span className="font-mono text-xs truncate max-w-[100px]">
                      {entry.wallet}
                      {entry.isCurrentUser && <span className="text-primary ml-1">•</span>}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      idx === 0
                        ? "bg-primary text-primary-foreground px-2 py-0.5 rounded"
                        : highlightColor
                    }`}
                  >
                    {formatStat(entry)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer">
            All Leaders →
          </button>
        </>
      )}
    </Card>
  )
}

// Volume Leaders entry from API
interface VolumeLeaderEntry {
  rank: number
  wallet: string
  volume: number
  volumeEth: number
  swapCount: number
  avgSize: number
  largestSwap?: number
  largestSwapEth?: number
}

const VOLUME_TABS = ["Volume", "Avg Size", "Largest"] as const
type VolumeTab = (typeof VOLUME_TABS)[number]

const TAB_TO_SORT: Record<VolumeTab, string> = {
  Volume: "volume",
  "Avg Size": "avg_size",
  Largest: "largest",
}

const TAB_TO_LABEL: Record<VolumeTab, string> = {
  Volume: "VOLUME",
  "Avg Size": "AVG SIZE",
  Largest: "LARGEST",
}

function formatVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  if (v >= 1) return `$${v.toFixed(0)}`
  return `$${v.toFixed(2)}`
}

function getStatForTab(entry: VolumeLeaderEntry, tab: VolumeTab): string {
  switch (tab) {
    case "Volume":
      return formatVol(entry.volume)
    case "Avg Size":
      return formatVol(entry.avgSize)
    case "Largest":
      return formatVol(entry.largestSwap ?? 0)
  }
}

const VolumeLeadersCard = ({ initialData }: { initialData: LeaderboardEntry[] }) => {
  const [activeTab, setActiveTab] = useState<VolumeTab>("Volume")
  const [largestData, setLargestData] = useState<VolumeLeaderEntry[] | null>(null)
  const [isLargestLoading, setIsLargestLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalEntries, setModalEntries] = useState<VolumeLeaderEntry[]>([])
  const [isModalLoading, setIsModalLoading] = useState(false)

  // Derive Volume and Avg Size entries from already-loaded leaderboard data
  const derivedEntries = useMemo((): VolumeLeaderEntry[] => {
    const mapped = initialData.map((e, i) => ({
      rank: i + 1,
      wallet: e.wallet,
      volume: e.swapVolume24h,
      volumeEth: e.ethValue ?? 0,
      swapCount: e.swapCount ?? 0,
      avgSize: (e.swapCount ?? 0) > 0 ? e.swapVolume24h / (e.swapCount ?? 1) : 0,
    }))
    if (activeTab === "Avg Size") {
      mapped.sort((a, b) => b.avgSize - a.avgSize)
      return mapped.map((e, i) => ({ ...e, rank: i + 1 }))
    }
    return mapped
  }, [initialData, activeTab])

  const fetchFromApi = useCallback(async (sort: string, limit: number) => {
    const res = await fetch(`/api/analytics/leaderboard/volume-leaders?sort=${sort}&limit=${limit}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.entries || []) as VolumeLeaderEntry[]
  }, [])

  // Only fetch when Largest tab is selected (needs separate query)
  useEffect(() => {
    if (activeTab !== "Largest") return
    if (largestData) return // Already fetched
    let cancelled = false
    setIsLargestLoading(true)
    fetchFromApi("largest", 10).then((data) => {
      if (!cancelled) {
        setLargestData(data)
        setIsLargestLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [activeTab, largestData, fetchFromApi])

  const handleAllLeaders = useCallback(async () => {
    setModalOpen(true)
    setIsModalLoading(true)
    const data = await fetchFromApi(TAB_TO_SORT[activeTab], 100)
    setModalEntries(data)
    setIsModalLoading(false)
  }, [activeTab, fetchFromApi])

  // Pick the right entries for the active tab
  const entries = activeTab === "Largest" ? (largestData ?? []) : derivedEntries
  const isLoading = activeTab === "Largest" && isLargestLoading
  const leader = entries[0]
  const statLabel = TAB_TO_LABEL[activeTab]

  return (
    <>
      <Card className="p-4 md:p-6 bg-white/[0.01] border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-primary" />
          <h3 className="font-bold text-sm">Volume Leaders</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle size={14} className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p><span className="font-bold text-foreground">Volume</span> — Total swap volume</p>
              <p><span className="font-bold text-foreground">Avg Size</span> — Average swap size</p>
              <p><span className="font-bold text-foreground">Largest</span> — Biggest single swap</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Internal tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
          {VOLUME_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">Loading...</p>
          </div>
        ) : !leader ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <BarChart3 size={32} className="text-muted-foreground/15" />
            <p className="text-xs text-muted-foreground/30 font-medium">No data available yet</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4">
              {/* Leader highlight */}
              <div className="flex flex-col items-center justify-center p-4 bg-white/[0.02] rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <span className="text-sm font-black uppercase tracking-widest text-primary">
                    #1
                  </span>
                </div>
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mt-1">
                  {statLabel}
                </p>
                <p className="text-lg font-black tabular-nums">
                  {getStatForTab(leader, activeTab)}
                </p>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.wallet}
                    className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                      idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/40 w-6 text-xs font-mono">
                        {idx + 1}.
                      </span>
                      <span className="font-mono text-xs truncate max-w-[100px]">
                        {entry.wallet}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-xs font-bold ${
                        idx === 0
                          ? "bg-primary text-primary-foreground px-2 py-0.5 rounded"
                          : ""
                      }`}
                    >
                      {getStatForTab(entry, activeTab)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleAllLeaders}
              className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer"
            >
              All Leaders →
            </button>
          </>
        )}
      </Card>

      {/* All Leaders Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              Volume Leaders — {activeTab}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60">
              Top 100 wallets sorted by {activeTab.toLowerCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-hide">
            {isModalLoading ? (
              <div className="p-8 text-center text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
                Loading top 100...
              </div>
            ) : (
              modalEntries.map((entry, idx) => (
                <div
                  key={entry.wallet}
                  className={`flex items-center justify-between py-2 px-3 rounded text-sm ${
                    idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground/40 w-8 text-xs font-mono text-right">
                      {entry.rank}.
                    </span>
                    <span className="font-mono text-sm truncate max-w-[200px]">
                      {entry.wallet}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                      {entry.swapCount} swaps
                    </span>
                    <span
                      className={`font-mono text-sm font-bold tabular-nums ${
                        idx === 0
                          ? "bg-primary text-primary-foreground px-2 py-0.5 rounded"
                          : ""
                      }`}
                    >
                      {getStatForTab(entry, activeTab)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Efficiency Leaders types and component
interface EfficiencyLeaderEntry {
  rank: number
  wallet: string
  swapCount: number
  activeDays?: number
  txsPerDay?: number
  streak?: number
  volume: number
  volumeEth: number
}

const EFFICIENCY_TABS = ["Tx Count", "Tx/Day", "Streak"] as const
type EfficiencyTab = (typeof EFFICIENCY_TABS)[number]

const EFFICIENCY_TAB_TO_SORT: Record<EfficiencyTab, string> = {
  "Tx Count": "tx_count",
  "Tx/Day": "txs_per_day",
  Streak: "streak",
}

const EFFICIENCY_TAB_TO_LABEL: Record<EfficiencyTab, string> = {
  "Tx Count": "TX COUNT",
  "Tx/Day": "TX/DAY",
  Streak: "STREAK",
}

function getEfficiencyStat(entry: EfficiencyLeaderEntry, tab: EfficiencyTab): string {
  switch (tab) {
    case "Tx Count":
      return entry.swapCount.toLocaleString()
    case "Tx/Day":
      return (entry.txsPerDay ?? 0).toFixed(1)
    case "Streak":
      return `${entry.streak ?? 0}d`
  }
}

function getEfficiencySubtext(entry: EfficiencyLeaderEntry, tab: EfficiencyTab): string {
  switch (tab) {
    case "Tx Count":
      return `${entry.swapCount} swaps`
    case "Tx/Day":
      return `${entry.activeDays ?? 0} active days`
    case "Streak":
      return `${entry.swapCount} swaps`
  }
}

const EfficiencyLeadersCard = ({ initialData }: { initialData: LeaderboardEntry[] }) => {
  const [activeTab, setActiveTab] = useState<EfficiencyTab>("Tx Count")
  const [txsPerDayData, setTxsPerDayData] = useState<EfficiencyLeaderEntry[] | null>(null)
  const [streakData, setStreakData] = useState<EfficiencyLeaderEntry[] | null>(null)
  const [isFetchLoading, setIsFetchLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalEntries, setModalEntries] = useState<EfficiencyLeaderEntry[]>([])
  const [isModalLoading, setIsModalLoading] = useState(false)

  // Derive Tx Count entries from already-loaded leaderboard data
  const derivedEntries = useMemo((): EfficiencyLeaderEntry[] => {
    const mapped = initialData.map((e, i) => ({
      rank: i + 1,
      wallet: e.wallet,
      swapCount: e.swapCount ?? 0,
      volume: e.swapVolume24h,
      volumeEth: e.ethValue ?? 0,
    }))
    return mapped
  }, [initialData])

  const fetchFromApi = useCallback(async (sort: string, limit: number) => {
    const res = await fetch(`/api/analytics/leaderboard/efficiency-leaders?sort=${sort}&limit=${limit}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.entries || []) as EfficiencyLeaderEntry[]
  }, [])

  // Fetch Tx/Day or Streak data on demand
  useEffect(() => {
    if (activeTab === "Tx Count") return
    if (activeTab === "Tx/Day" && txsPerDayData) return
    if (activeTab === "Streak" && streakData) return

    let cancelled = false
    setIsFetchLoading(true)
    fetchFromApi(EFFICIENCY_TAB_TO_SORT[activeTab], 10).then((data) => {
      if (!cancelled) {
        if (activeTab === "Tx/Day") setTxsPerDayData(data)
        else setStreakData(data)
        setIsFetchLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [activeTab, txsPerDayData, streakData, fetchFromApi])

  const handleAllLeaders = useCallback(async () => {
    setModalOpen(true)
    setIsModalLoading(true)
    const data = await fetchFromApi(EFFICIENCY_TAB_TO_SORT[activeTab], 100)
    setModalEntries(data)
    setIsModalLoading(false)
  }, [activeTab, fetchFromApi])

  // Pick entries for active tab
  const entries =
    activeTab === "Tx/Day"
      ? (txsPerDayData ?? [])
      : activeTab === "Streak"
        ? (streakData ?? [])
        : derivedEntries
  const isLoading = activeTab !== "Tx Count" && isFetchLoading && entries.length === 0
  const leader = entries[0]
  const statLabel = EFFICIENCY_TAB_TO_LABEL[activeTab]

  return (
    <>
      <Card className="p-4 md:p-6 bg-white/[0.01] border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-primary" />
          <h3 className="font-bold text-sm">Efficiency Leaders</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle size={14} className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p><span className="font-bold text-foreground">Tx Count</span> — Most total swaps</p>
              <p><span className="font-bold text-foreground">Tx/Day</span> — Highest daily swap frequency</p>
              <p><span className="font-bold text-foreground">Streak</span> — Longest consecutive active days</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Internal tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
          {EFFICIENCY_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">Loading...</p>
          </div>
        ) : !leader ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <BarChart3 size={32} className="text-muted-foreground/15" />
            <p className="text-xs text-muted-foreground/30 font-medium">No data available yet</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4">
              {/* Leader highlight */}
              <div className="flex flex-col items-center justify-center p-4 bg-white/[0.02] rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <span className="text-sm font-black uppercase tracking-widest text-primary">
                    #1
                  </span>
                </div>
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mt-1">
                  {statLabel}
                </p>
                <p className="text-lg font-black tabular-nums">
                  {getEfficiencyStat(leader, activeTab)}
                </p>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.wallet}
                    className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                      idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/40 w-6 text-xs font-mono">
                        {idx + 1}.
                      </span>
                      <span className="font-mono text-xs truncate max-w-[100px]">
                        {entry.wallet}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-xs font-bold ${
                        idx === 0
                          ? "bg-primary text-primary-foreground px-2 py-0.5 rounded"
                          : ""
                      }`}
                    >
                      {getEfficiencyStat(entry, activeTab)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleAllLeaders}
              className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer"
            >
              All Leaders →
            </button>
          </>
        )}
      </Card>

      {/* All Leaders Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              Efficiency Leaders — {activeTab}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60">
              Top 100 wallets sorted by {activeTab.toLowerCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-hide">
            {isModalLoading ? (
              <div className="p-8 text-center text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
                Loading top 100...
              </div>
            ) : (
              modalEntries.map((entry, idx) => (
                <div
                  key={entry.wallet}
                  className={`flex items-center justify-between py-2 px-3 rounded text-sm ${
                    idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground/40 w-8 text-xs font-mono text-right">
                      {entry.rank}.
                    </span>
                    <span className="font-mono text-sm truncate max-w-[200px]">
                      {entry.wallet}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                      {getEfficiencySubtext(entry, activeTab)}
                    </span>
                    <span
                      className={`font-mono text-sm font-bold tabular-nums ${
                        idx === 0
                          ? "bg-primary text-primary-foreground px-2 py-0.5 rounded"
                          : ""
                      }`}
                    >
                      {getEfficiencyStat(entry, activeTab)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Referral Leaders types and component
interface ReferralLeaderEntry {
  rank: number
  wallet: string
  points: number
  referrals: number
}

const REFERRAL_TABS = ["Total Refs", "Miles"] as const
type ReferralTab = (typeof REFERRAL_TABS)[number]

const REFERRAL_TAB_TO_LABEL: Record<ReferralTab, string> = {
  "Total Refs": "REFERRALS",
  Miles: "MILES",
}

function getReferralStat(entry: ReferralLeaderEntry, tab: ReferralTab): string {
  switch (tab) {
    case "Total Refs":
      return entry.referrals.toLocaleString()
    case "Miles":
      return entry.points.toLocaleString()
  }
}

function getReferralSubtext(entry: ReferralLeaderEntry, tab: ReferralTab): string {
  switch (tab) {
    case "Total Refs":
      return `${entry.points.toLocaleString()} miles`
    case "Miles":
      return `${entry.referrals} refs`
  }
}

const ReferralLeadersCard = ({ prefetchedData }: { prefetchedData: { byPoints: ReferralLeaderEntry[]; byRefs: ReferralLeaderEntry[] } | null }) => {
  const [activeTab, setActiveTab] = useState<ReferralTab>("Total Refs")
  const [modalOpen, setModalOpen] = useState(false)
  const [modalEntries, setModalEntries] = useState<ReferralLeaderEntry[]>([])
  const [isModalLoading, setIsModalLoading] = useState(false)

  const byPoints = prefetchedData?.byPoints ?? []
  const byRefs = prefetchedData?.byRefs ?? []
  const isLoading = !prefetchedData

  const handleAllLeaders = useCallback(async () => {
    setModalOpen(true)
    setIsModalLoading(true)
    const res = await fetch("/api/fuul/leaderboard?limit=100")
    const json = res.ok ? await res.json() : null
    const entries = json ? (activeTab === "Total Refs" ? json.byRefs : json.byPoints) : []
    setModalEntries(entries)
    setIsModalLoading(false)
  }, [activeTab])

  const entries = activeTab === "Total Refs" ? byRefs : byPoints

  const leader = entries[0]
  const statLabel = REFERRAL_TAB_TO_LABEL[activeTab]
  const showLoading = isLoading && entries.length === 0

  return (
    <>
      <Card className="p-4 md:p-6 bg-white/[0.01] border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-primary" />
          <h3 className="font-bold text-sm">Referral Leaders</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle size={14} className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p><span className="font-bold text-foreground">Total Refs</span> — Most referrals made</p>
              <p><span className="font-bold text-foreground">Miles</span> — Most miles earned from referrals</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Internal tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
          {REFERRAL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {showLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">Loading...</p>
          </div>
        ) : !leader ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <BarChart3 size={32} className="text-muted-foreground/15" />
            <p className="text-xs text-muted-foreground/30 font-medium">No data available yet</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4">
              {/* Leader highlight */}
              <div className="flex flex-col items-center justify-center p-4 bg-white/[0.02] rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <span className="text-sm font-black uppercase tracking-widest text-primary">
                    #1
                  </span>
                </div>
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mt-1">
                  {statLabel}
                </p>
                <p className="text-lg font-black tabular-nums">
                  {getReferralStat(leader, activeTab)}
                </p>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.wallet}
                    className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                      idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/40 w-6 text-xs font-mono">
                        {idx + 1}.
                      </span>
                      <span className="font-mono text-xs truncate max-w-[100px]">
                        {entry.wallet}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-xs font-bold ${
                        idx === 0
                          ? "bg-primary text-primary-foreground px-2 py-0.5 rounded"
                          : ""
                      }`}
                    >
                      {getReferralStat(entry, activeTab)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleAllLeaders}
              className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer"
            >
              All Leaders →
            </button>
          </>
        )}
      </Card>

      {/* All Leaders Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              Referral Leaders — {activeTab}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60">
              Top 100 wallets sorted by {activeTab.toLowerCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-hide">
            {isModalLoading ? (
              <div className="p-8 text-center text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
                Loading top 100...
              </div>
            ) : (
              modalEntries.map((entry, idx) => (
                <div
                  key={entry.wallet}
                  className={`flex items-center justify-between py-2 px-3 rounded text-sm ${
                    idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground/40 w-8 text-xs font-mono text-right">
                      {entry.rank}.
                    </span>
                    <span className="font-mono text-sm truncate max-w-[200px]">
                      {entry.wallet}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                      {getReferralSubtext(entry, activeTab)}
                    </span>
                    <span
                      className={`font-mono text-sm font-bold tabular-nums ${
                        idx === 0
                          ? "bg-primary text-primary-foreground px-2 py-0.5 rounded"
                          : ""
                      }`}
                    >
                      {getReferralStat(entry, activeTab)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
