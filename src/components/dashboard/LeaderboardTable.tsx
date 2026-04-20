"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { formatCurrency } from "@/lib/utils"
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
import { VolumeLeadersCard } from "./leaderboard/VolumeLeadersCard"
import { EfficiencyLeadersCard } from "./leaderboard/EfficiencyLeadersCard"
import { ReferralLeadersCard, type ReferralLeaderEntry } from "./leaderboard/ReferralLeadersCard"
import { RisingStarsCard } from "./leaderboard/RisingStarsCard"
import { LeaderboardHeader } from "./leaderboard/LeaderboardHeader"
import { VolumeProgressAnalysis } from "./leaderboard/VolumeProgressAnalysis"
import { MilesProgressAnalysis } from "./leaderboard/MilesProgressAnalysis"
import { MilesModeTable } from "./leaderboard/MilesModeTable"
import { VolumeModeTable } from "./leaderboard/VolumeModeTable"
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
      <LeaderboardHeader
        leaderboardMode={leaderboardMode}
        onModeChange={setLeaderboardMode}
        activeTraders={activeTraders}
        swapVolumeEth={swapVolumeEth}
        totalVol={totalVol}
        totalParticipants={totalParticipants}
        totalMiles={totalMiles}
        formatVolumeDisplay={formatVolumeDisplay}
        userAddr={userAddr}
        userMilesEntry={userMilesEntry}
        nextMilesRankEntry={nextMilesRankEntry}
        adjustedUserPos={adjustedUserPos}
        adjustedUserVol={adjustedUserVol}
        userSwapCount={userSwapCount}
      />

      {leaderboardMode === "volume" && (
        <VolumeProgressAnalysis
          userAddr={userAddr}
          adjustedUserPos={adjustedUserPos}
          adjustedUserVol={adjustedUserVol}
          adjustedNextRankVol={adjustedNextRankVol}
          currentTier={currentTier}
          currentTierMeta={currentTierMeta}
          nextTierName={nextTierName}
          nextTierMeta={nextTierMeta}
          nextTierVal={nextTierVal}
          progress={progress}
          tierBackgroundClass={tierBackgroundClass}
          formatVolumeShort={formatVolumeShort}
          formatVolDiffDisplay={formatVolDiffDisplay}
        />
      )}

      {leaderboardMode === "miles" && (
        <MilesProgressAnalysis
          userAddr={userAddr}
          userMilesEntry={userMilesEntry}
          nextMilesRankEntry={nextMilesRankEntry}
        />
      )}

      {leaderboardMode === "miles" ? (
        <MilesModeTable
          userAddr={userAddr}
          userMilesEntry={userMilesEntry}
          milesLeaderboard={milesLeaderboard}
          isMilesLoading={isMilesLoading}
          milesModalOpen={milesModalOpen}
          onMilesModalOpenChange={setMilesModalOpen}
          milesModalBuildParams={milesModalBuildParams}
          milesModalFindMeParams={milesModalFindMeParams}
        />
      ) : leaderboardMode === "volume" ? (
        <VolumeModeTable
          userAddr={userAddr}
          lbData={lbData}
          filteredLbData={filteredLbData}
          milesByWallet={milesByWallet}
          tierFilter={tierFilter}
          onTierFilterChange={setTierFilter}
          adjustedUserPos={adjustedUserPos}
          adjustedUserVol={adjustedUserVol}
          userSwapCount={userSwapCount}
          volumeModalOpen={volumeModalOpen}
          onVolumeModalOpenChange={setVolumeModalOpen}
          volumeModalBuildParams={volumeModalBuildParams}
          volumeModalFindMeParams={volumeModalFindMeParams}
          formatVolumeDisplay={formatVolumeDisplay}
          isLoadingProp={isLoadingProp}
        />
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
