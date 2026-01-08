"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useAccount } from "wagmi"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, Zap } from "lucide-react"
import { formatCurrency, formatWalletAddress } from "@/lib/utils"
import {
  TIER_THRESHOLDS,
  getTierFromVolume,
  getTierMetadata,
  getNextTier,
  type Tier,
} from "@/lib/constants"

interface LeaderboardEntry {
  wallet: string
  rank: number
  swapVolume24h: number
  change24h: number
  isCurrentUser?: boolean
}

interface LeaderboardData {
  success: boolean
  leaderboard?: LeaderboardEntry[]
  userVolume?: number | null
  userPosition?: number | null
  nextRankVolume?: number | null
}

interface LeaderboardTableProps {
  address?: string
  preloadedData?: LeaderboardData
  preloadedActiveTraders?: number | null
  preloadedSwapVolumeEth?: number | null
  preloadedEthPrice?: number | null
}

export const LeaderboardTable = ({
  address,
  preloadedData,
  preloadedActiveTraders,
  preloadedSwapVolumeEth,
  preloadedEthPrice,
}: LeaderboardTableProps) => {
  // State Management
  const { address: conn } = useAccount()
  const userAddr = address || conn

  const [activeTraders, setActiveTraders] = useState<number | null>(preloadedActiveTraders ?? null)
  const [swapVolumeEth, setSwapVolumeEth] = useState<number | null>(preloadedSwapVolumeEth ?? null)
  const [ethPrice, setEthPrice] = useState<number | null>(preloadedEthPrice ?? null)
  const [lbData, setLbData] = useState<LeaderboardEntry[]>([])
  const [userVol, setUserVol] = useState<number | null>(null)
  const [userPos, setUserPos] = useState<number | null>(null)
  const [nextRankVol, setNextRankVol] = useState<number | null>(null)
  const [userSwapTxs, setUserSwapTxs] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Computed Values
  const totalVol = useMemo(
    () => (swapVolumeEth && ethPrice ? swapVolumeEth * ethPrice : null),
    [swapVolumeEth, ethPrice]
  )

  // Data Fetching: Preloaded Data
  useEffect(() => {
    if (preloadedData?.success) {
      setLbData(preloadedData.leaderboard || [])
      setUserVol(preloadedData.userVolume || null)
      setUserPos(preloadedData.userPosition || null)
      setNextRankVol(preloadedData.nextRankVolume || null)
      setIsLoading(false)
    }
  }, [preloadedData])

  // Data Fetching: API Calls
  useEffect(() => {
    if (preloadedData?.success) return

    const fetchData = async () => {
      try {
        setIsLoading(true)

        if (!preloadedActiveTraders) {
          try {
            const response = await fetch("/api/analytics/active-traders")
            if (response.ok) {
              const data = await response.json()
              if (data.success && data.activeTraders !== null) {
                setActiveTraders(Number(data.activeTraders))
              }
            }
          } catch (error) {
            console.error("Error fetching active traders:", error)
          }
        }

        if (!preloadedSwapVolumeEth || !preloadedEthPrice) {
          try {
            const [swapVolumeResponse, ethPriceResponse] = await Promise.all([
              fetch("/api/analytics/volume/swap"),
              fetch("/api/analytics/eth-price"),
            ])

            if (swapVolumeResponse.ok && ethPriceResponse.ok) {
              const swapVolumeData = await swapVolumeResponse.json()
              const ethPriceData = await ethPriceResponse.json()

              if (swapVolumeData.success && swapVolumeData.cumulativeSwapVolEth !== null) {
                setSwapVolumeEth(Number(swapVolumeData.cumulativeSwapVolEth))
              }

              if (ethPriceData.success && ethPriceData.ethPrice !== null) {
                setEthPrice(Number(ethPriceData.ethPrice))
              }
            }
          } catch (error) {
            console.error("Error fetching total volume:", error)
          }
        }

        try {
          const res = await fetch(
            userAddr
              ? `/api/analytics/leaderboard?currentUser=${userAddr}`
              : "/api/analytics/leaderboard"
          )
          const data = await res.json()
          if (data.success) {
            setLbData(data.leaderboard || [])
            setUserVol(data.userVolume || null)
            setUserPos(data.userPosition || null)
            setNextRankVol(data.nextRankVolume || null)
          }
        } catch (error) {
          console.error("Error fetching leaderboard:", error)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [userAddr, preloadedData, preloadedActiveTraders, preloadedSwapVolumeEth, preloadedEthPrice])

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

  // Tier Calculations
  const currentTier = useMemo(() => getTierFromVolume(userVol), [userVol])
  const currentTierMeta = useMemo(() => getTierMetadata(currentTier), [currentTier])
  const nextTierVal = useMemo(() => getNextTier(userVol), [userVol])
  const progress = useMemo(
    () => Math.min(((userVol || 0) / nextTierVal) * 100, 100),
    [userVol, nextTierVal]
  )
  const nextTierName = useMemo(() => {
    const vol = userVol || 0
    if (vol < TIER_THRESHOLDS.BRONZE) return "Bronze"
    if (vol < TIER_THRESHOLDS.SILVER) return "Silver"
    return "Gold"
  }, [userVol])
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
                    #{userPos || "--"}
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
                    {userVol ? formatVolumeDisplay(userVol) : "$0.00"}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Progress Tracker Card */}
        <Card className="p-3 sm:p-4 bg-white/[0.01] border-white/5 flex flex-col justify-center space-y-2 sm:space-y-3 min-w-0 w-full">
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
        <Card className="overflow-hidden border-white/5 bg-white/[0.01] transition-all duration-300 hover:border-primary/20 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-stretch min-h-[80px]">
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
                  {userPos ? (
                    <>
                      $urpass <span className="italic font-bold">#{userPos - 1}</span> with{" "}
                      <span className="text-primary font-black decoration-primary/20 tabular-nums">
                        {nextRankVol && userVol
                          ? formatVolDiffDisplay(nextRankVol - userVol)
                          : "--"}
                      </span>
                      <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                        Reach <span className={nextTierMeta.color}>{nextTierName}</span> in{" "}
                        {userVol ? formatVolDiffDisplay(nextTierVal - userVol) : "--"}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/30 font-black uppercase tracking-widest italic">
                      Network synchronization in progress...
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
        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-12 px-3 sm:px-4 md:px-6 text-[8px] font-black uppercase tracking-[0.4em] text-muted-foreground/30 min-w-[600px]">
          <div className="col-span-2">POS</div>
          <div className="col-span-6">IDENTIFIER</div>
          <div className="col-span-4 text-right">VOLUME / 24H</div>
        </div>

        {/* Table Rows */}
        <div className="space-y-1.5 w-full">
          {isLoading ? (
            <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20 animate-pulse">
              Synchronizing Data...
            </div>
          ) : lbData.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-20">
              No leaderboard data available
            </div>
          ) : (
            lbData.map((entry) => {
              const shouldShowDivider = userPos && userPos > 15 && entry.rank === 15
              return (
                <React.Fragment key={entry.wallet}>
                  {/* Leaderboard Row */}
                  <div
                    className={`grid grid-cols-12 items-center px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-xl border transition-all min-w-0 ${
                      entry.isCurrentUser
                        ? "bg-primary/[0.05] border-primary/30"
                        : "bg-card/20 border-white/5"
                    }`}
                  >
                    <div className="col-span-2 min-w-0">
                      <span className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter text-muted-foreground/10 whitespace-nowrap">
                        {entry.rank.toString().padStart(2, "0")}
                      </span>
                    </div>
                    <div className="col-span-7 sm:col-span-6 flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-mono text-sm sm:text-base md:text-lg truncate">
                        {formatWalletAddress(entry.wallet)}
                      </span>
                      {entry.isCurrentUser && (
                        <Badge className="bg-primary text-[9px] sm:text-[10px] h-4 sm:h-5 px-1.5 sm:px-2 font-black shrink-0">
                          YOU
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-3 sm:col-span-4 text-right min-w-0">
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
                </React.Fragment>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
