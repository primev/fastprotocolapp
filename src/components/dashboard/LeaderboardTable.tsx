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
import {
  TrendingUp,
  Target,
  Zap,
  Users,
  Flame,
  HelpCircle,
  BarChart3,
  Compass,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
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

  const [leaderboardMode, setLeaderboardMode] = useState<"volume" | "miles" | "stats">("miles")

  // Single fetch for all Fuul leaderboard data (miles + referral cards)
  const [milesLeaderboard, setMilesLeaderboard] = useState<
    { wallet: string; points: number; referrals: number; rank: number }[]
  >([])
  const [referralData, setReferralData] = useState<{
    byPoints: ReferralLeaderEntry[]
    byRefs: ReferralLeaderEntry[]
  } | null>(null)
  const [isMilesLoading, setIsMilesLoading] = useState(false)
  // Server-provided totals (covers ALL participants, not just page 1)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [totalMiles, setTotalMiles] = useState(0)
  useEffect(() => {
    setIsMilesLoading(true)
    fetch("/api/fuul/leaderboard?limit=100&page=1&sort=miles")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json) return
        const entries: { wallet: string; points: number; referrals: number; rank: number }[] =
          json.entries ||
          json.byPoints?.map((e: ReferralLeaderEntry, i: number) => ({ ...e, rank: i + 1 })) ||
          []
        setMilesLeaderboard(entries)
        // Use server-provided totals (computed from full dataset)
        if (json.totalParticipants != null) setTotalParticipants(json.totalParticipants)
        else setTotalParticipants(entries.length)
        if (json.totalMiles != null) setTotalMiles(json.totalMiles)
        else
          setTotalMiles(entries.reduce((sum: number, e: { points: number }) => sum + e.points, 0))
        // Derive referral card data from the same dataset
        const byPoints = [...entries]
          .sort((a, b) => b.points - a.points)
          .slice(0, 10)
          .map((e, i) => ({ ...e, rank: i + 1 }))
        const byRefs = [...entries]
          .sort((a, b) => b.referrals - a.referrals)
          .slice(0, 10)
          .map((e, i) => ({ ...e, rank: i + 1 }))
        setReferralData({ byPoints, byRefs })
      })
      .catch(() => {})
      .finally(() => setIsMilesLoading(false))
  }, [])

  // Find user in miles leaderboard
  const userMilesEntry = useMemo(() => {
    if (!userAddr || !milesLeaderboard.length) return null
    const trimmed = trimWalletAddress(userAddr.toLowerCase())
    return milesLeaderboard.find((e) => e.wallet === trimmed) ?? null
  }, [userAddr, milesLeaderboard])

  // Wallet-to-miles lookup for volume leaderboard rows
  const milesByWallet = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of milesLeaderboard) map.set(e.wallet, e.points)
    return map
  }, [milesLeaderboard])

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

  // Fetch tier-filtered data from API when tier is not "all"
  const [tierFilteredData, setTierFilteredData] = useState<LeaderboardEntry[] | null>(null)
  const [isTierLoading, setIsTierLoading] = useState(false)
  useEffect(() => {
    if (tierFilter === "all") {
      setTierFilteredData(null)
      return
    }
    let cancelled = false
    setIsTierLoading(true)
    const params = new URLSearchParams({
      sort: "volume",
      tier: tierFilter,
      page: "1",
      limit: "15",
    })
    fetch(`/api/analytics/leaderboard/volume-leaders?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.entries) {
          setTierFilteredData(
            data.entries.map((e: any) => ({
              wallet: e.wallet,
              rank: e.rank,
              swapVolume24h: e.volume || 0,
              swapCount: e.swapCount || 0,
              change24h: 0,
              ethValue: e.volumeEth || 0,
            }))
          )
          setIsTierLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsTierLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tierFilter])

  const filteredLbData = tierFilter === "all" ? adjustedLbData : (tierFilteredData ?? [])

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

              <div className="flex flex-col items-center sm:border-l sm:border-white/5 sm:pl-5 text-center">
                <span className="text-[8px] font-black uppercase text-muted-foreground/30 block mb-0.5">
                  Referrals
                </span>
                <p className="text-[10px] font-bold leading-none">
                  {userMilesEntry?.referrals.toLocaleString() ?? "---"}
                </p>
              </div>
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
                          <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                            {userMilesEntry.referrals} referral
                            {userMilesEntry.referrals !== 1 ? "s" : ""} earned
                          </span>
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
                        <span className="text-[10px] sm:text-xs text-muted-foreground/60 font-mono">
                          {entry.referrals.toLocaleString()} referral
                          {entry.referrals !== 1 ? "s" : ""}
                        </span>
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
                    <span className="text-[10px] sm:text-xs text-muted-foreground/60 font-mono">
                      {userMilesEntry
                        ? `${userMilesEntry.referrals.toLocaleString()} referral${userMilesEntry.referrals !== 1 ? "s" : ""}`
                        : "0 referrals"}
                    </span>
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
            renderSubtext={(e) => `${Number((e as any).referrals ?? 0)} referrals`}
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
                All Leaders &rarr;
              </button>
            </div>
            <div className="space-y-1.5 w-full">
              {(isLoadingProp && lbData.length === 0) || isTierLoading ? (
                <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20 animate-pulse">
                  Loading leaderboard...
                </div>
              ) : lbData.length === 0 && tierFilter === "all" ? (
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
                        miles={milesByWallet.get(entry.wallet) ?? null}
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
            title="Volume Leaders"
            description="All wallets sorted by swap volume"
            fetchUrl="/api/analytics/leaderboard/volume-leaders"
            buildParams={volumeModalBuildParams}
            renderStat={(e) => formatVolumeDisplay(Number((e as any).volume ?? 0))}
            renderSubtext={(e) => `${Number((e as any).swapCount ?? 0)} swaps`}
            userWallet={userAddr}
            findMeParams={volumeModalFindMeParams}
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
            <ReferralLeadersCard prefetchedData={referralData} userWallet={userAddr} />
            <RisingStarsCard userWallet={userAddr} userVolume={adjustedUserVol} />
          </div>
        </div>
      )}
    </div>
  )
}

// Individual Leaderboard Row Component
interface LeaderboardRowProps {
  entry: LeaderboardEntry
  formatVolumeDisplay: (v: number) => string
  showYouBadge?: boolean
  miles?: number | null
}

const LeaderboardRow = ({
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

// ─── Paginated All Leaders Modal ─────────────────────────────────────────────

const PAGE_SIZE = 25

interface PaginatedModalEntry {
  rank: number
  wallet: string
  [key: string]: unknown
}

/** Build page number array with ellipsis: [1, '...', 4, 5, 6, '...', 20] */
function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "...")[] = []
  // Always show first page
  pages.push(1)
  // Left ellipsis
  if (current > 3) pages.push("...")
  // Window around current
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  // Right ellipsis
  if (current < total - 2) pages.push("...")
  // Always show last page
  pages.push(total)
  return pages
}

interface PaginatedLeaderboardModalProps {
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
}

const PaginatedLeaderboardModal = ({
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
}: PaginatedLeaderboardModalProps) => {
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<PaginatedModalEntry[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightWallet, setHighlightWallet] = useState<string | null>(null)
  const [findMeLoading, setFindMeLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const highlightRef = React.useRef<HTMLDivElement>(null)

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
  const findMeTriggeredRef = React.useRef(false)

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
      <DialogContent className="max-w-2xl max-h-[85vh] bg-background border-white/10 flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-black">{title}</DialogTitle>
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

const VolumeLeadersCard = ({
  initialData,
  tierFilter,
  userWallet,
  userVolume,
}: {
  initialData: LeaderboardEntry[]
  tierFilter: string
  userWallet?: string
  userVolume?: number | null
}) => {
  const [activeTab, setActiveTab] = useState<VolumeTab>("Volume")
  const [apiData, setApiData] = useState<VolumeLeaderEntry[] | null>(null)
  const [isApiLoading, setIsApiLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Derive Volume and Avg Size entries from already-loaded leaderboard data (all tier only)
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

  // Fetch from API when tier is not "all" or tab is "Largest" (needs server-side query)
  useEffect(() => {
    const needsApiFetch = tierFilter !== "all" || activeTab === "Largest"
    if (!needsApiFetch) {
      setApiData(null)
      return
    }
    let cancelled = false
    setIsApiLoading(true)
    const sort = TAB_TO_SORT[activeTab]
    const params = new URLSearchParams({
      sort,
      tier: tierFilter,
      page: "1",
      limit: "15",
    })
    fetch(`/api/analytics/leaderboard/volume-leaders?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setApiData((data?.entries || []) as VolumeLeaderEntry[])
          setIsApiLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsApiLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, tierFilter])

  const modalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: TAB_TO_SORT[activeTab],
      tier: tierFilter,
      page: String(p),
      limit: String(l),
    }),
    [activeTab, tierFilter]
  )

  // Only show Find Me if user's tier matches the filter (or filter is "all")
  const userTier = useMemo(() => getTierFromVolume(userVolume), [userVolume])
  const canFindMe = tierFilter === "all" || userTier === tierFilter
  const modalFindMeParams = useMemo(() => {
    if (!canFindMe) return undefined
    return {
      category: "volume",
      sort: TAB_TO_SORT[activeTab],
      tier: tierFilter,
    }
  }, [activeTab, tierFilter, canFindMe])

  // Use API data when fetched (tier filter or Largest), otherwise use derived from initialData
  const entries = apiData !== null ? apiData : derivedEntries
  const isLoading = isApiLoading
  const leader = entries[0]
  const statLabel = TAB_TO_LABEL[activeTab]

  return (
    <>
      <Card className="group/card relative p-4 md:p-6 bg-white/[0.01] border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp size={14} className="text-primary" />
          </div>
          <h3 className="font-bold text-sm">Volume Leaders</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={14}
                className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p>
                <span className="font-bold text-foreground">Volume</span> — Total swap volume
              </p>
              <p>
                <span className="font-bold text-foreground">Avg Size</span> — Average swap size
              </p>
              <p>
                <span className="font-bold text-foreground">Largest</span> — Biggest single swap
              </p>
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
            <p className="text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
              Loading...
            </p>
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
              <div className="flex flex-col items-center p-4 bg-gradient-to-b from-white/[0.03] to-transparent rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
                {(() => {
                  const tm = getTierMetadata(getTierFromVolume(leader.volume))
                  return (
                    <div
                      className={`relative w-16 h-16 rounded-full ${tm.circleBg} flex items-center justify-center mb-4 ring-2 ring-offset-2 ring-offset-background ${tm.color.replace("text-", "ring-")}/20`}
                    >
                      <span className={`text-sm font-black uppercase tracking-widest ${tm.color}`}>
                        #1
                      </span>
                    </div>
                  )
                })()}
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <div className="mt-auto pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">
                    {statLabel}
                  </p>
                  <p className="text-lg font-black tabular-nums text-center">
                    {getStatForTab(leader, activeTab)}
                  </p>
                </div>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => {
                  const entryTm =
                    tierFilter === "all" && idx < 3
                      ? getTierMetadata(getTierFromVolume(entry.volume))
                      : null
                  return (
                    <div
                      key={entry.wallet}
                      className={`flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors ${
                        idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground/40 w-6 text-xs font-mono flex items-center gap-1">
                          {entryTm && (
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${entryTm.dot}`}
                            />
                          )}
                          {idx + 1}.
                        </span>
                        <span className="font-mono text-xs truncate max-w-[100px]">
                          {entry.wallet}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold ${
                          idx === 0 ? "bg-primary text-primary-foreground px-2 py-0.5 rounded" : ""
                        }`}
                      >
                        {getStatForTab(entry, activeTab)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer"
            >
              All Leaders →
            </button>
          </>
        )}
      </Card>

      <PaginatedLeaderboardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={`Volume Leaders — ${activeTab}`}
        description={`All wallets sorted by ${activeTab.toLowerCase()}`}
        fetchUrl="/api/analytics/leaderboard/volume-leaders"
        buildParams={modalBuildParams}
        renderStat={(e) => getStatForTab(e as unknown as VolumeLeaderEntry, activeTab)}
        renderSubtext={(e) => `${(e as unknown as VolumeLeaderEntry).swapCount ?? 0} swaps`}
        userWallet={userWallet}
        findMeParams={modalFindMeParams}
      />
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
  currentStreak?: number
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
      return entry.currentStreak && entry.currentStreak > 0
        ? `${entry.currentStreak}d active`
        : "inactive"
  }
}

const EfficiencyLeadersCard = ({
  initialData,
  tierFilter,
  userWallet,
  userVolume,
}: {
  initialData: LeaderboardEntry[]
  tierFilter: string
  userWallet?: string
  userVolume?: number | null
}) => {
  const [activeTab, setActiveTab] = useState<EfficiencyTab>("Tx Count")
  const [apiData, setApiData] = useState<EfficiencyLeaderEntry[] | null>(null)
  const [isApiLoading, setIsApiLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Derive Tx Count entries from already-loaded leaderboard data (all tier only)
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

  // Fetch from API when tier is not "all" or tab needs server-side query
  useEffect(() => {
    const needsApiFetch = tierFilter !== "all" || activeTab !== "Tx Count"
    if (!needsApiFetch) {
      setApiData(null)
      return
    }
    let cancelled = false
    setIsApiLoading(true)
    const sort = EFFICIENCY_TAB_TO_SORT[activeTab]
    const params = new URLSearchParams({
      sort,
      tier: tierFilter,
      page: "1",
      limit: "15",
    })
    fetch(`/api/analytics/leaderboard/efficiency-leaders?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setApiData((data?.entries || []) as EfficiencyLeaderEntry[])
          setIsApiLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsApiLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, tierFilter])

  const modalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: EFFICIENCY_TAB_TO_SORT[activeTab],
      tier: tierFilter,
      page: String(p),
      limit: String(l),
    }),
    [activeTab, tierFilter]
  )

  // Only show Find Me if user's tier matches the filter (or filter is "all")
  const userTier = useMemo(() => getTierFromVolume(userVolume), [userVolume])
  const canFindMe = tierFilter === "all" || userTier === tierFilter
  const modalFindMeParams = useMemo(() => {
    if (!canFindMe) return undefined
    return {
      category: "efficiency",
      sort: EFFICIENCY_TAB_TO_SORT[activeTab],
      tier: tierFilter,
    }
  }, [activeTab, tierFilter, canFindMe])

  // Use API data when fetched, otherwise use derived from initialData
  const entries = apiData !== null ? apiData : derivedEntries
  const isLoading = isApiLoading
  const leader = entries[0]
  const statLabel = EFFICIENCY_TAB_TO_LABEL[activeTab]

  return (
    <>
      <Card className="group/card relative p-4 md:p-6 bg-white/[0.01] border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Zap size={14} className="text-primary" />
          </div>
          <h3 className="font-bold text-sm">Efficiency Leaders</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={14}
                className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p>
                <span className="font-bold text-foreground">Tx Count</span> — Most total swaps
              </p>
              <p>
                <span className="font-bold text-foreground">Tx/Day</span> — Highest daily swap
                frequency
              </p>
              <p>
                <span className="font-bold text-foreground">Streak</span> — Longest consecutive
                active days
              </p>
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
            <p className="text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
              Loading...
            </p>
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
              <div className="flex flex-col items-center p-4 bg-gradient-to-b from-white/[0.03] to-transparent rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
                {(() => {
                  const tm = getTierMetadata(getTierFromVolume(leader.volume))
                  return (
                    <div
                      className={`relative w-16 h-16 rounded-full ${tm.circleBg} flex items-center justify-center mb-4 ring-2 ring-offset-2 ring-offset-background ${tm.color.replace("text-", "ring-")}/20`}
                    >
                      <span className={`text-sm font-black uppercase tracking-widest ${tm.color}`}>
                        #1
                      </span>
                    </div>
                  )
                })()}
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <div className="mt-auto pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">
                    {statLabel}
                  </p>
                  <p className="text-lg font-black tabular-nums text-center">
                    {getEfficiencyStat(leader, activeTab)}
                  </p>
                </div>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => {
                  const entryTm =
                    tierFilter === "all" && idx < 3
                      ? getTierMetadata(getTierFromVolume(entry.volume))
                      : null
                  return (
                    <div
                      key={entry.wallet}
                      className={`flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors ${
                        idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground/40 w-6 text-xs font-mono flex items-center gap-1">
                          {entryTm && (
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${entryTm.dot}`}
                            />
                          )}
                          {idx + 1}.
                        </span>
                        <span className="font-mono text-xs truncate max-w-[100px]">
                          {entry.wallet}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold ${
                          idx === 0 ? "bg-primary text-primary-foreground px-2 py-0.5 rounded" : ""
                        }`}
                      >
                        {getEfficiencyStat(entry, activeTab)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer"
            >
              All Leaders →
            </button>
          </>
        )}
      </Card>

      <PaginatedLeaderboardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={`Efficiency Leaders — ${activeTab}`}
        description={`All wallets sorted by ${activeTab.toLowerCase()}`}
        fetchUrl="/api/analytics/leaderboard/efficiency-leaders"
        buildParams={modalBuildParams}
        renderStat={(e) => getEfficiencyStat(e as unknown as EfficiencyLeaderEntry, activeTab)}
        renderSubtext={(e) =>
          getEfficiencySubtext(e as unknown as EfficiencyLeaderEntry, activeTab)
        }
        userWallet={userWallet}
        findMeParams={modalFindMeParams}
      />
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

const ReferralLeadersCard = ({
  prefetchedData,
  userWallet,
}: {
  prefetchedData: { byPoints: ReferralLeaderEntry[]; byRefs: ReferralLeaderEntry[] } | null
  userWallet?: string
}) => {
  const [activeTab, setActiveTab] = useState<ReferralTab>("Total Refs")
  const [modalOpen, setModalOpen] = useState(false)

  const byPoints = prefetchedData?.byPoints ?? []
  const byRefs = prefetchedData?.byRefs ?? []
  const isLoading = !prefetchedData

  const modalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: activeTab === "Total Refs" ? "refs" : "miles",
      page: String(p),
      limit: String(l),
    }),
    [activeTab]
  )

  const entries = activeTab === "Total Refs" ? byRefs : byPoints

  const leader = entries[0]
  const statLabel = REFERRAL_TAB_TO_LABEL[activeTab]
  const showLoading = isLoading && entries.length === 0

  return (
    <>
      <Card className="group/card relative p-4 md:p-6 bg-white/[0.01] border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Users size={14} className="text-primary" />
          </div>
          <h3 className="font-bold text-sm">Referral Leaders</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={14}
                className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p>
                <span className="font-bold text-foreground">Total Refs</span> — Most referrals made
              </p>
              <p>
                <span className="font-bold text-foreground">Miles</span> — Most miles earned from
                referrals
              </p>
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
            <p className="text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
              Loading...
            </p>
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
              <div className="flex flex-col items-center p-4 bg-gradient-to-b from-white/[0.03] to-transparent rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
                <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 ring-2 ring-offset-2 ring-offset-background ring-primary/20">
                  <span className="text-sm font-black uppercase tracking-widest text-primary">
                    #1
                  </span>
                </div>
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <div className="mt-auto pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">
                    {statLabel}
                  </p>
                  <p className="text-lg font-black tabular-nums text-center">
                    {getReferralStat(leader, activeTab)}
                  </p>
                </div>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.wallet}
                    className={`flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors ${
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
                        idx === 0 ? "bg-primary text-primary-foreground px-2 py-0.5 rounded" : ""
                      }`}
                    >
                      {getReferralStat(entry, activeTab)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer"
            >
              All Leaders →
            </button>
          </>
        )}
      </Card>

      <PaginatedLeaderboardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={`Referral Leaders — ${activeTab}`}
        description={`All wallets sorted by ${activeTab.toLowerCase()}`}
        fetchUrl="/api/fuul/leaderboard"
        buildParams={modalBuildParams}
        renderStat={(e) => getReferralStat(e as unknown as ReferralLeaderEntry, activeTab)}
        renderSubtext={(e) => getReferralSubtext(e as unknown as ReferralLeaderEntry, activeTab)}
        userWallet={userWallet}
      />
    </>
  )
}

// Rising Stars types and component
interface RisingStarEntry {
  rank: number
  wallet: string
  stat: number
  statLabel: string
  swapCount?: number
  volume?: number
}

const RISING_TABS = ["Climbers", "New Users", "WoW Growth"] as const
type RisingTab = (typeof RISING_TABS)[number]

const RISING_TAB_TO_SORT: Record<RisingTab, string> = {
  Climbers: "climbers",
  "New Users": "new_users",
  "WoW Growth": "wow_growth",
}

const RISING_TAB_TO_LABEL: Record<RisingTab, string> = {
  Climbers: "INCREASE",
  "New Users": "VOLUME",
  "WoW Growth": "GROWTH",
}

function getRisingStat(entry: RisingStarEntry, tab: RisingTab): string {
  switch (tab) {
    case "Climbers":
      return `+${formatRisingVol(entry.stat)}`
    case "New Users":
      return formatRisingVol(entry.stat)
    case "WoW Growth":
      return `${entry.stat >= 0 ? "+" : ""}${entry.stat.toFixed(0)}%`
  }
}

function getRisingSubtext(entry: RisingStarEntry, tab: RisingTab): string {
  switch (tab) {
    case "Climbers":
      return formatRisingVol(entry.volume ?? 0)
    case "New Users":
      return `${entry.swapCount ?? 0} swaps`
    case "WoW Growth":
      return formatRisingVol(entry.volume ?? 0)
  }
}

function formatRisingVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  if (v >= 1) return `$${v.toFixed(0)}`
  return `$${v.toFixed(2)}`
}

const RisingStarsCard = ({
  userWallet,
  userVolume,
}: {
  userWallet?: string
  userVolume?: number | null
}) => {
  const [activeTab, setActiveTab] = useState<RisingTab>("Climbers")
  const [data, setData] = useState<Record<string, RisingStarEntry[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchFromApi = useCallback(async (sort: string, limit: number) => {
    const res = await fetch(`/api/analytics/leaderboard/rising-stars?sort=${sort}&limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.entries || []) as RisingStarEntry[]
  }, [])

  // Fetch data for the active tab
  useEffect(() => {
    const sort = RISING_TAB_TO_SORT[activeTab]
    if (data[sort]) return

    let cancelled = false
    setIsLoading(true)
    fetchFromApi(sort, 10).then((entries) => {
      if (!cancelled) {
        setData((prev) => ({ ...prev, [sort]: entries }))
        setIsLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [activeTab, data, fetchFromApi])

  const modalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: RISING_TAB_TO_SORT[activeTab],
      page: String(p),
      limit: String(l),
    }),
    [activeTab]
  )

  // Only show Find Me if user is standard tier (below Bronze — Rising Stars only includes standard)
  const isStandardTier = useMemo(() => getTierFromVolume(userVolume) === "standard", [userVolume])
  const modalFindMeParams = useMemo(() => {
    if (!isStandardTier) return undefined
    return {
      category: "rising",
      sort: RISING_TAB_TO_SORT[activeTab],
      tier: "all",
    }
  }, [activeTab, isStandardTier])

  const entries = data[RISING_TAB_TO_SORT[activeTab]] ?? []
  const leader = entries[0]
  const statLabel = RISING_TAB_TO_LABEL[activeTab]
  const showLoading = isLoading && entries.length === 0

  return (
    <>
      <Card className="group/card relative p-4 md:p-6 bg-white/[0.01] border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Flame size={14} className="text-primary" />
          </div>
          <h3 className="font-bold text-sm">Rising Stars</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={14}
                className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p>
                <span className="font-bold text-foreground">Climbers</span> — Biggest volume
                increase this week
              </p>
              <p>
                <span className="font-bold text-foreground">New Users</span> — Top performers who
                joined in the last 30 days
              </p>
              <p>
                <span className="font-bold text-foreground">WoW Growth</span> — Highest
                week-over-week volume growth %
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Internal tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
          {RISING_TABS.map((tab) => (
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
            <p className="text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
              Loading...
            </p>
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
              <div className="flex flex-col items-center p-4 bg-gradient-to-b from-white/[0.03] to-transparent rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
                <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 ring-2 ring-offset-2 ring-offset-background ring-primary/20">
                  <span className="text-sm font-black uppercase tracking-widest text-primary">
                    #1
                  </span>
                </div>
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <div className="mt-auto pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">
                    {statLabel}
                  </p>
                  <p className="text-lg font-black tabular-nums text-green-500 text-center">
                    {getRisingStat(leader, activeTab)}
                  </p>
                </div>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.wallet}
                    className={`flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors ${
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
                      className={`font-mono text-xs font-bold text-green-500 ${
                        idx === 0 ? "bg-green-500/20 text-green-400 px-2 py-0.5 rounded" : ""
                      }`}
                    >
                      {getRisingStat(entry, activeTab)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer"
            >
              All Leaders →
            </button>
          </>
        )}
      </Card>

      <PaginatedLeaderboardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={`Rising Stars — ${activeTab}`}
        description={`All wallets sorted by ${activeTab.toLowerCase()}`}
        fetchUrl="/api/analytics/leaderboard/rising-stars"
        buildParams={modalBuildParams}
        renderStat={(e) => getRisingStat(e as unknown as RisingStarEntry, activeTab)}
        renderSubtext={(e) => getRisingSubtext(e as unknown as RisingStarEntry, activeTab)}
        userWallet={userWallet}
        findMeParams={modalFindMeParams}
      />
    </>
  )
}
