"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useAccount } from "wagmi"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, Zap } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
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
}

interface LeaderboardData {
  success: boolean
  leaderboard?: LeaderboardEntry[]
  userVolume?: number | null
  userPosition?: number | null
  nextRankVolume?: number | null
  ethPrice?: number | null
}

interface LeaderboardStats {
  activeTraders: number | null
  swapVolumeEth: number | null
  ethPrice: number | null
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
  const ethPrice = statsData?.ethPrice ?? leaderboardData?.ethPrice ?? null
  const lbData = leaderboardData?.leaderboard || []
  const userVol = leaderboardData?.userVolume ?? null
  const userPos = leaderboardData?.userPosition ?? null
  const nextRankVol = leaderboardData?.nextRankVolume ?? null

  // Only userSwapTxs needs separate state since it's not in leaderboardData
  const [userSwapTxs, setUserSwapTxs] = useState<number | null>(null)

  // Computed Values
  const totalVol = useMemo(
    () => (swapVolumeEth && ethPrice ? swapVolumeEth * ethPrice : null),
    [swapVolumeEth, ethPrice]
  )

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
          // Use userSwapTxs if swapCount is not available from API
          swapCount:
            entry.swapCount !== undefined
              ? entry.swapCount
              : userSwapTxs !== null
                ? userSwapTxs
                : undefined,
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
        swapCount: userSwapTxs !== null ? userSwapTxs : undefined,
        change24h: 0,
        isCurrentUser: true,
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
      // Add user entry after top 15 with actual position from API
      displayData = [
        ...top15,
        {
          wallet: trimWalletAddress(userAddr.toLowerCase()),
          rank: userPos, // Use actual API position
          swapVolume24h: adjustedUserVol,
          swapCount: userSwapTxs !== null ? userSwapTxs : undefined,
          change24h: 0,
          isCurrentUser: true,
        },
      ]
    }

    return {
      adjustedLbData: displayData,
      adjustedUserPos: newPos,
      adjustedNextRankVol: newNextRankVol,
    }
  }, [lbData, adjustedUserVol, userPos, nextRankVol, userAddr, userSwapTxs])

  // Data fetching removed - all data comes from React Query via props
  // Only fetch userSwapTxs separately since it's not part of leaderboardData

  // Fetch user swap transactions (only when wallet is connected)
  useEffect(() => {
    if (!userAddr) {
      setUserSwapTxs(null)
      return
    }

    const fetchSwapTxs = async () => {
      try {
        const userResponse = await fetch(`/api/analytics/user/${userAddr}`)
        if (userResponse.ok) {
          const userData = await userResponse.json()
          if (userData.swapTxs !== null && userData.swapTxs !== undefined) {
            setUserSwapTxs(Number(userData.swapTxs))
          } else {
            setUserSwapTxs(null)
          }
        }
      } catch (error) {
        console.error("Error fetching user swap transactions:", error)
        setUserSwapTxs(null)
      }
    }

    fetchSwapTxs()
  }, [userAddr])

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

  return (
    <div className="w-full max-w-7xl mx-auto pt-2 pb-4 md:py-8 px-3 sm:px-4 md:px-6 space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Header Section: Title & Global Stats */}
      <div className="flex flex-col gap-5 border-b border-white/5 pb-6">
        {/* Branding & Global Metrics */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
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

          <div className="flex items-center gap-6 sm:gap-10">
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">
                Traders
              </span>
              <span className="text-xl sm:text-2xl font-bold tabular-nums tracking-tighter">
                {activeTraders?.toLocaleString() || "---"}
              </span>
            </div>
            <div className="flex flex-col items-start md:items-end md:border-l md:border-white/10 md:pl-10">
              <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">
                Total Volume
              </span>
              <span className="text-xl sm:text-2xl font-bold tabular-nums tracking-tighter">
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
                  {userSwapTxs !== null && userSwapTxs !== undefined
                    ? userSwapTxs.toLocaleString()
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

      {/* Leaderboard Table Section */}
      <div className="space-y-2 w-full overflow-x-auto">
        {/* Table Rows */}
        <div className="space-y-1.5 w-full">
          {isLoadingProp && lbData.length === 0 ? (
            // Only show loading state if we truly have no data and are loading
            <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20 animate-pulse">
              Loading leaderboard...
            </div>
          ) : lbData.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20">
              No leaderboard data available
            </div>
          ) : (
            adjustedLbData.map((entry, index) => {
              // Show divider before user entry when they're outside top 15
              const shouldShowDivider =
                adjustedUserPos && adjustedUserPos > 15 && entry.isCurrentUser && index === 15
              return (
                <React.Fragment key={entry.wallet}>
                  {/* User Position Divider */}
                  {shouldShowDivider && (
                    <div className="flex items-center gap-4 py-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">
                        Your Position
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    </div>
                  )}
                  {/* Leaderboard Row */}
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
                          const entryTier = getTierFromVolume(entry.swapVolume24h)
                          const tierMeta = getTierMetadata(entryTier)
                          const tierColorClasses = {
                            gold: {
                              accent: "bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]",
                              text: "text-yellow-500/80",
                              bloom: "from-yellow-500/30",
                            },
                            silver: {
                              accent: "bg-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.3)]",
                              text: "text-slate-400/80",
                              bloom: "from-slate-400/20",
                            },
                            bronze: {
                              accent: "bg-amber-700 shadow-[0_0_15px_rgba(180,83,9,0.2)]",
                              text: "text-amber-600/80",
                              bloom: "from-amber-800/20",
                            },
                            standard: {
                              accent: "",
                              text: "",
                              bloom: "",
                            },
                          }
                          const tierColors =
                            tierColorClasses[entryTier as keyof typeof tierColorClasses] ||
                            tierColorClasses.standard

                          return (
                            <>
                              {/* The "Podium Light" - A very thin, elegant vertical accent */}
                              <div
                                className={`absolute left-[-1.5rem] top-1/2 -translate-y-1/2 w-[3px] h-10 rounded-full blur-[1px] transition-all duration-500 group-hover/rank:h-12 ${tierColors.accent}`}
                              />

                              {/* Background Bloom - Only for top 3, very soft */}
                              <div
                                className={`absolute inset-0 -left-6 w-24 h-full bg-gradient-to-r to-transparent -z-10 opacity-20 pointer-events-none transition-opacity duration-700 group-hover/rank:opacity-40 ${tierColors.bloom}`}
                              />
                            </>
                          )
                        })()}

                      {/* Rank Number with "Engraved" look */}
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

                        {/* Tier Label for top 3 */}
                        {entry.rank <= 3 &&
                          (() => {
                            const entryTier = getTierFromVolume(entry.swapVolume24h)
                            const tierMeta = getTierMetadata(entryTier)
                            const tierColorClasses = {
                              gold: "text-yellow-500/80",
                              silver: "text-slate-400/80",
                              bronze: "text-amber-600/80",
                              standard: "",
                            }
                            const textColor =
                              tierColorClasses[entryTier as keyof typeof tierColorClasses] ||
                              tierColorClasses.standard

                            return (
                              <span
                                className={`text-[8px] font-bold uppercase tracking-[0.3em] mt-1 transition-colors ${textColor}`}
                              >
                                {tierMeta.label}
                              </span>
                            )
                          })()}
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
                      {entry.isCurrentUser && (
                        <Badge className="bg-primary text-[9px] sm:text-[10px] h-4 sm:h-5 px-1.5 sm:px-2 font-black shrink-0">
                          YOU
                        </Badge>
                      )}
                    </div>
                    <div className="hidden sm:flex col-span-2 justify-end items-center min-w-0 group/miles">
                      {/* The Container: Uses a very subtle glassmorphism effect to house the status */}
                      <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/[0.01] border border-white/[0.03]">
                        {/* Text Stack: Uses high-end spacing for a "technical" look */}
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">
                            Miles
                          </span>
                          <span className="text-[7px] font-black uppercase tracking-[0.2em] text-primary/50 italic">
                            Pending
                          </span>
                        </div>

                        {/* The Bolt: Styled as a neon filament */}
                        <div className="relative flex items-center justify-center">
                          {/* Background Bloom: Creates a soft 'light' behind the icon so it doesn't look flat */}
                          <div className="absolute inset-0 bg-primary/10 blur-[6px] rounded-full" />

                          {/* The Icon: High stroke width with a hollow center for elegance */}
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
                      <p className="text-base sm:text-xl md:text-2xl font-black tracking-tighter tabular-nums whitespace-nowrap">
                        {formatVolumeDisplay(entry.swapVolume24h)}
                      </p>
                      <div
                        className={`text-[9px] sm:text-[10px] md:text-xs font-bold whitespace-nowrap ${
                          entry.change24h >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {entry.change24h >= 0 ? "+" : ""}
                        {entry.change24h.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
