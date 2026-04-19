"use client"

import { Fragment, useState, useMemo, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, Zap } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { trimWalletAddress } from "@/lib/analytics/services/leaderboard-transform"
import { FEATURE_FLAGS } from "@/lib/config/feature-flags"
import { useFuulMilesLeaderboard } from "@/hooks/use-fuul-miles-leaderboard"
import { useUserPoints } from "@/hooks/use-user-points"
import {
  TIER_THRESHOLDS,
  getTierFromVolume,
  getTierMetadata,
  getNextTier,
  TESTING_VOLUME_MULTIPLIER,
} from "@/lib/config/constants"
import { LeaderboardRow } from "./leaderboard/LeaderboardRow"
import { PaginatedLeaderboardModal } from "./leaderboard/PaginatedLeaderboardModal"
import { VolumeLeadersCard } from "./leaderboard/VolumeLeadersCard"
import { EfficiencyLeadersCard } from "./leaderboard/EfficiencyLeadersCard"
import { ReferralLeadersCard, type ReferralLeaderEntry } from "./leaderboard/ReferralLeadersCard"
import { RisingStarsCard } from "./leaderboard/RisingStarsCard"
import type { LeaderboardData, LeaderboardStats } from "./leaderboard/types"

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
}: LeaderboardTableProps) => {
  // State Management - only for data not provided by React Query
  const { address: conn } = useAccount()
  // Avoid hydration mismatch: wagmi's `conn` is only available after mount,
  // so defer any user-conditional UI until after the first client render.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const userAddr = mounted ? address || conn : undefined

  // Get data from props (React Query managed)
  const activeTraders = statsData?.activeTraders ?? null
  const swapVolumeEth = statsData?.swapVolumeEth ?? null
  const swapVolumeUsd = statsData?.swapVolumeUsd ?? null
  const lbData = leaderboardData?.leaderboard || []
  const userVol = leaderboardData?.userVolume ?? null
  const userPos = leaderboardData?.userPosition ?? null
  const nextRankVol = leaderboardData?.nextRankVolume ?? null

  const totalVol = useMemo(() => swapVolumeUsd ?? null, [swapVolumeUsd])

  const [leaderboardMode, setLeaderboardMode] = useState<"volume" | "miles" | "stats">(
    FEATURE_FLAGS.show_miles_estimate ? "miles" : "volume"
  )

  // Shared Fuul miles leaderboard query. Listens for `refetch-user-miles`
  // events so that when a swap transitions from pending → processed the
  // miles tables refresh automatically, and the AppHeader stays in sync.
  const { data: fuulMilesData, isLoading: isMilesLoading } = useFuulMilesLeaderboard()
  const milesLeaderboard = useMemo(() => fuulMilesData?.entries ?? [], [fuulMilesData?.entries])
  const totalParticipants = fuulMilesData?.totalParticipants ?? 0
  const totalMiles = fuulMilesData?.totalMiles ?? 0
  const referralData = useMemo<{
    byPoints: ReferralLeaderEntry[]
    byRefs: ReferralLeaderEntry[]
  } | null>(() => {
    if (!milesLeaderboard.length) return null
    const byPoints = [...milesLeaderboard]
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }))
    const byRefs = [...milesLeaderboard]
      .sort((a, b) => b.referrals - a.referrals)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }))
    return { byPoints, byRefs }
  }, [milesLeaderboard])

  // AppHeader badge value (per-user Fuul totals — updates faster than the
  // leaderboard dataset). When the leaderboard hasn't caught up yet we
  // surface the header value as the floor for the connected user's row
  // so the leaderboard never shows a smaller number than the badge.
  const { points: headerPoints } = useUserPoints()

  // Find user in miles leaderboard
  const userMilesEntry = useMemo(() => {
    if (!userAddr || !milesLeaderboard.length) return null
    const trimmed = trimWalletAddress(userAddr.toLowerCase())
    const found = milesLeaderboard.find((e) => e.wallet === trimmed) ?? null
    if (!found) return null
    if (headerPoints > found.points) {
      return { ...found, points: headerPoints }
    }
    return found
  }, [userAddr, milesLeaderboard, headerPoints])

  // Wallet-to-miles lookup for volume leaderboard rows. Override the
  // connected user's entry with the AppHeader value when it's higher.
  const milesByWallet = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of milesLeaderboard) map.set(e.wallet, e.points)
    if (userAddr && headerPoints > 0) {
      const trimmed = trimWalletAddress(userAddr.toLowerCase())
      const current = map.get(trimmed) ?? 0
      if (headerPoints > current) map.set(trimmed, headerPoints)
    }
    return map
  }, [milesLeaderboard, userAddr, headerPoints])

  // Next rank miles (person above user)
  const nextMilesRankEntry = useMemo(() => {
    if (!userMilesEntry || userMilesEntry.rank <= 1) return null
    return milesLeaderboard.find((e) => e.rank === userMilesEntry.rank - 1) ?? null
  }, [userMilesEntry, milesLeaderboard])

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
    const adjusted = lbData.map((entry) => {
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

    // Keep full ranked list for tier filtering; display is sliced later
    const top15 = ranked
    const userInTop15 = ranked.slice(0, 15).some((e) => e.isCurrentUser)

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

  const [tierFilter, setTierFilter] = useState<string>("all")

  // "All Leaders" modal state — Miles
  const [milesModalOpen, setMilesModalOpen] = useState(false)
  const milesModalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: "miles",
      page: String(p),
      limit: String(l),
    }),
    []
  )
  const milesModalFindMeParams = useMemo(() => {
    if (!userAddr) return undefined
    return { sort: "miles" }
  }, [userAddr])

  // "All Leaders" modal state — Volume
  const [volumeModalOpen, setVolumeModalOpen] = useState(false)
  const volumeModalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: "volume",
      tier: tierFilter,
      page: String(p),
      limit: String(l),
    }),
    [tierFilter]
  )
  const volumeModalFindMeParams = useMemo(() => {
    if (!userAddr) return undefined
    const userTier = getTierFromVolume(adjustedUserVol)
    if (tierFilter !== "all" && userTier !== tierFilter) return undefined
    return {
      category: "volume",
      sort: "volume",
      tier: tierFilter,
    }
  }, [userAddr, tierFilter, adjustedUserVol])

  // Formatting Helpers
  const formatVolumeDisplay = (v: number) => {
    if (v >= 1e6) return formatCurrency(v, { maximumFractionDigits: 1 })
    if (v < 100) return formatCurrency(v, { maximumFractionDigits: 2 })
    return `$${Math.floor(v).toLocaleString()}`
  }

  /** Compact shorthand: $10K, $2.5M, $1B */
  const formatVolumeShort = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(v % 1e9 === 0 ? 0 : 1)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1)}K`
    return `$${v}`
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

  // Filter leaderboard data by tier (client-side from top 100 dataset)
  // When "all", show top 15 with global ranks. When filtered, re-rank within tier (1, 2, 3...)
  const filteredLbData = useMemo(() => {
    if (tierFilter === "all") {
      // Show top 15 + user entry if outside top 15
      const top15 = adjustedLbData.filter((e) => !e.isCurrentUser).slice(0, 15)
      const userEntry = adjustedLbData.find((e) => e.isCurrentUser)
      if (userEntry && !top15.some((e) => e.wallet === userEntry.wallet)) {
        return [...top15, userEntry]
      }
      return top15
    }
    const filtered = adjustedLbData
      .filter((entry) => {
        if (entry.isCurrentUser) return false
        return getTierFromVolume(entry.swapVolume24h) === tierFilter
      })
      .slice(0, 15)
    return filtered.map((entry, i) => ({ ...entry, rank: i + 1 }))
  }, [adjustedLbData, tierFilter])

  // Stats: sorted variants for stats tab
  const statsByTxCount = useMemo(
    () =>
      [...adjustedLbData]
        .filter((e) => !e.isCurrentUser)
        .sort((a, b) => (b.swapCount ?? 0) - (a.swapCount ?? 0))
        .slice(0, 10),
    [adjustedLbData]
  )
  const statsByVolume = useMemo(
    () =>
      [...adjustedLbData]
        .filter((e) => !e.isCurrentUser)
        .sort((a, b) => b.swapVolume24h - a.swapVolume24h)
        .slice(0, 10),
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
              <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-full p-0.5">
                {FEATURE_FLAGS.show_miles_estimate && (
                  <button
                    onClick={() => setLeaderboardMode("miles")}
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
                  onClick={() => setLeaderboardMode("volume")}
                  className={`px-3.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full transition-all ${
                    leaderboardMode === "volume"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground/50 hover:text-muted-foreground/80"
                  }`}
                >
                  Volume
                </button>
                <button
                  onClick={() => setLeaderboardMode("stats")}
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
                      <span className="text-primary/80">#{(userMilesEntry?.rank ?? 0) - 1}</span>{" "}
                      with{" "}
                      <span className="text-primary/80">
                        {(
                          nextMilesRankEntry.points - (userMilesEntry?.points ?? 0)
                        ).toLocaleString()}{" "}
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

      {/* Progress & Analysis Section (volume mode only) */}
      {leaderboardMode === "volume" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
          {/* Progress Tracker Card */}
          <Card className="p-3 sm:p-4 bg-white/[0.01] border-white/5 flex flex-col justify-center space-y-2 sm:space-y-3 min-w-0 w-full h-full">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/40 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Target size={10} className="sm:w-3 sm:h-3 shrink-0" />{" "}
                <span className="whitespace-nowrap">Progress Tracker</span>
              </div>
              <span className="text-primary font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0">
                {nextTierName.toLowerCase() !== currentTier
                  ? `${currentTier === "standard" ? "Standard" : currentTierMeta.label} → ${nextTierMeta.label} (${formatVolumeShort(nextTierVal)})`
                  : "Max Tier Reached"}
              </span>
            </div>
            <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-primary transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Major tier labels */}
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
                    {formatVolumeShort(t.v)}
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
                          <span className="text-primary font-black">Congratulations!</span> You're
                          in <span className="italic font-bold text-primary">#1</span> position.
                          <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-primary/80 uppercase tracking-widest">
                            Hold that lead
                          </span>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const diff = (adjustedNextRankVol ?? 0) - (adjustedUserVol ?? 0)
                            if (adjustedNextRankVol && adjustedUserVol && diff > 0) {
                              return (
                                <>
                                  Surpass{" "}
                                  <span className="italic font-bold">#{adjustedUserPos - 1}</span>{" "}
                                  with{" "}
                                  <span className="text-primary font-black decoration-primary/20 tabular-nums">
                                    {formatVolDiffDisplay(diff)}
                                  </span>
                                </>
                              )
                            }
                            return (
                              <>
                                You're closing in on{" "}
                                <span className="italic font-bold text-primary">
                                  #{adjustedUserPos - 1}
                                </span>
                                {" — keep trading!"}
                              </>
                            )
                          })()}
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
      )}

      {/* Miles Progress & Analysis Section */}
      {leaderboardMode === "miles" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
          {/* Miles Progress Tracker */}
          <Card className="p-3 sm:p-4 bg-white/[0.01] border-white/5 flex flex-col justify-center space-y-2 sm:space-y-3 min-w-0 w-full h-full">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/40 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Target size={10} className="sm:w-3 sm:h-3 shrink-0" />{" "}
                <span className="whitespace-nowrap">Miles Progress</span>
              </div>
              <span className="text-primary font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0">
                {(userMilesEntry?.points ?? 0).toLocaleString()} / 1,000 Miles
              </span>
            </div>
            <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-primary transition-all duration-1000"
                style={{ width: `${Math.min(((userMilesEntry?.points ?? 0) / 1000) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between gap-1 sm:gap-2 min-w-0">
              {[
                { n: "250", v: 250 },
                { n: "500", v: 500 },
                { n: "1,000", v: 1000 },
              ].map((m) => (
                <div key={m.n} className="flex flex-col min-w-0">
                  <span className="text-sm sm:text-base font-black text-primary/70 whitespace-nowrap">
                    {m.n}
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono font-bold opacity-60 whitespace-nowrap truncate">
                    miles
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Miles Performance Analysis */}
          <Card className="overflow-hidden border-white/5 bg-white/[0.01] transition-all duration-300 hover:border-primary/20 shadow-2xl h-full flex">
            <div className="flex items-stretch w-full h-full">
              <div className="w-full p-4 sm:p-5 flex flex-col justify-center bg-primary/[0.01]">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center gap-2.5">
                    <Zap size={15} className="text-primary/40" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/60">
                      Miles Analysis
                    </h4>
                  </div>

                  <p className="text-sm sm:text-base font-bold leading-snug tracking-tight text-foreground/90">
                    {!userAddr ? (
                      <span className="text-[10px] sm:text-sm text-muted-foreground/40 font-black uppercase tracking-widest italic">
                        Connect wallet to track miles
                      </span>
                    ) : userMilesEntry ? (
                      userMilesEntry.rank === 1 ? (
                        <>
                          <span className="text-primary font-black">Congratulations!</span> You're
                          the <span className="italic font-bold text-primary">#1</span> miles
                          leader.
                          <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-primary/80 uppercase tracking-widest">
                            Hold that lead
                          </span>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const diff =
                              (nextMilesRankEntry?.points ?? 0) - (userMilesEntry?.points ?? 0)
                            if (nextMilesRankEntry && diff > 0) {
                              return (
                                <>
                                  Surpass{" "}
                                  <span className="italic font-bold">
                                    #{userMilesEntry.rank - 1}
                                  </span>{" "}
                                  with{" "}
                                  <span className="text-primary font-black tabular-nums">
                                    {diff.toLocaleString()} miles
                                  </span>
                                </>
                              )
                            }
                            return (
                              <>
                                You're closing in on{" "}
                                <span className="italic font-bold text-primary">
                                  #{userMilesEntry.rank - 1}
                                </span>
                                {" — keep earning!"}
                              </>
                            )
                          })()}
                          {FEATURE_FLAGS.show_referral_counts && (
                            <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                              {userMilesEntry.referrals} referral
                              {userMilesEntry.referrals !== 1 ? "s" : ""} earned
                            </span>
                          )}
                        </>
                      )
                    ) : (
                      <span className="text-[10px] sm:text-sm text-muted-foreground/30 font-black uppercase tracking-widest italic">
                        Earn miles by performing swaps
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Leaderboard Table Section */}
      {leaderboardMode === "miles" ? (
        /* ─── Miles Mode: Simple ranked list ─── */
        <div className="space-y-2">
          <div className="flex items-center justify-end mb-1">
            <button
              onClick={() => setMilesModalOpen(true)}
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
            onOpenChange={setMilesModalOpen}
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
      ) : leaderboardMode === "volume" ? (
        /* ─── Volume Mode: Standings ─── */
        <div className="space-y-4">
          {/* Standings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setTierFilter("all")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                    tierFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/[0.03] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTierFilter("gold")}
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
                  onClick={() => setTierFilter("silver")}
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
                  onClick={() => setTierFilter("bronze")}
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
                onClick={() => setVolumeModalOpen(true)}
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
            onOpenChange={setVolumeModalOpen}
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
      ) : (
        /* ─── Stats Mode: Cards Grid ─── */
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <VolumeLeadersCard
              initialData={statsByVolume}
              tierFilter={tierFilter}
              userWallet={userAddr}
              userVolume={adjustedUserVol}
            />
            <EfficiencyLeadersCard
              initialData={statsByTxCount}
              tierFilter={tierFilter}
              userWallet={userAddr}
              userVolume={adjustedUserVol}
            />
            {FEATURE_FLAGS.show_referral_counts && (
              <ReferralLeadersCard prefetchedData={referralData} userWallet={userAddr} />
            )}
            <RisingStarsCard userWallet={userAddr} userVolume={adjustedUserVol} />
          </div>
        </div>
      )}
    </div>
  )
}
