"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, Users, DollarSign, Award } from "lucide-react"

interface LeaderboardEntry {
  rank: number
  wallet: string
  swapVolume24h: number // Total swap volume in USD (ranked by this)
  change24h: number // 24h change percentage
  isCurrentUser?: boolean
}

interface LeaderboardProps {
  address?: string
  preloadedData?: {
    success: boolean
    leaderboard?: LeaderboardEntry[]
    userPosition?: number | null
    userVolume?: number | null
    nextRankVolume?: number | null
  } | null
  isPreloading?: boolean
  preloadedActiveTraders?: number | null
  preloadedSwapVolumeEth?: number | null
  preloadedEthPrice?: number | null
}

// Format wallet address with ellipsis (first 4 chars + ... + last 4 chars)
const formatWalletAddress = (address: string): string => {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

// Format volume in USD with detailed M/B/T notation as per spec (K, but do not show the "K" char)
// If showing a decimal, only show 2
const formatVolume = (volume: number): string => {
  if (volume >= 1_000_000_000_000) {
    return `$${(volume / 1_000_000_000_000).toFixed(2)}T`
  }
  if (volume >= 1_000_000_000) {
    return `$${(volume / 1_000_000_000).toFixed(2)}B`
  }
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`
  }
  if (volume >= 1_000) {
    // Show ALL digits to the left of decimal (no decimal at all), and no K character
    const digits = Math.floor(volume).toLocaleString("en-US", { maximumFractionDigits: 0 })
    return `$${digits}`
  }
  // For less than 1000, leave regular locale string (could have decimals, e.g. 532.11)
  // If it has decimal, cap to 2
  if (volume % 1 !== 0) {
    return `$${volume.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `$${volume.toLocaleString()}`
}

// Format 24h change as percentage
const formatChange24h = (change: number): string => {
  const sign = change >= 0 ? "+" : ""
  if (Math.abs(change) >= 100 && Number.isInteger(change)) {
    return `${sign}${change.toFixed(0)}%`
  }
  return `${sign}${change.toFixed(2)}%`
}

export const LeaderboardTable = ({
  address,
  preloadedData,
  isPreloading,
  preloadedActiveTraders,
  preloadedSwapVolumeEth,
  preloadedEthPrice,
}: LeaderboardProps) => {
  const { address: connectedAddress } = useAccount()
  const currentUserAddress = address || connectedAddress

  const [activeTraders, setActiveTraders] = useState<number | null>(preloadedActiveTraders ?? null)
  const [isLoadingActiveTraders, setIsLoadingActiveTraders] = useState(!preloadedActiveTraders)
  const [swapVolumeEth, setSwapVolumeEth] = useState<number | null>(preloadedSwapVolumeEth ?? null)
  const [ethPrice, setEthPrice] = useState<number | null>(preloadedEthPrice ?? null)
  const [isLoadingTotalVolume, setIsLoadingTotalVolume] = useState(
    !(preloadedSwapVolumeEth && preloadedEthPrice)
  )
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(!preloadedData && !isPreloading)
  const [userPosition, setUserPosition] = useState<number | null>(null)
  const [userVolume, setUserVolume] = useState<number | null>(null)
  const [nextRankVolume, setNextRankVolume] = useState<number | null>(null)

  // Use preloaded data if available
  useEffect(() => {
    if (preloadedData && preloadedData.success) {
      const leaderboard = preloadedData.leaderboard || []
      setLeaderboardData(leaderboard)
      setUserPosition(preloadedData.userPosition || null)
      setUserVolume(preloadedData.userVolume || null)
      setNextRankVolume(preloadedData.nextRankVolume || null)
      setIsLoadingLeaderboard(false)

      // // Debug logging
      // console.log('Using preloaded leaderboard data:', {
      //   userPosition: preloadedData.userPosition,
      //   userVolume: preloadedData.userVolume,
      //   nextRankVolume: preloadedData.nextRankVolume,
      //   volumeDifference: preloadedData.nextRankVolume && preloadedData.userVolume
      //     ? preloadedData.nextRankVolume - preloadedData.userVolume
      //     : null
      // })

      // // Log leaderboard data to console as a table
      // console.table(leaderboard.map(entry => ({
      //   Rank: entry.rank,
      //   Wallet: entry.wallet,
      //   'Total Volume (USD)': `$${entry.swapVolume24h.toLocaleString()}`,
      //   '24h Change': `${entry.change24h >= 0 ? '+' : ''}${entry.change24h.toFixed(2)}%`,
      //   'Is Current User': entry.isCurrentUser ? 'Yes' : 'No'
      // })))
    }
  }, [preloadedData])

  useEffect(() => {
    const fetchActiveTraders = async () => {
      // Skip if we already have preloaded data
      if (preloadedActiveTraders !== null && preloadedActiveTraders !== undefined) {
        setIsLoadingActiveTraders(false)
        return
      }

      try {
        setIsLoadingActiveTraders(true)
        const response = await fetch("/api/analytics/active-traders")

        if (!response.ok) {
          console.error("Failed to fetch active traders:", response.statusText)
          return
        }

        const data = await response.json()

        if (data.success && data.activeTraders !== null && data.activeTraders !== undefined) {
          setActiveTraders(Number(data.activeTraders))
        }
      } catch (error) {
        console.error("Error fetching active traders:", error)
      } finally {
        setIsLoadingActiveTraders(false)
      }
    }

    const fetchTotalVolume = async () => {
      // Skip if we already have preloaded data
      if (
        preloadedSwapVolumeEth !== null &&
        preloadedSwapVolumeEth !== undefined &&
        preloadedEthPrice !== null &&
        preloadedEthPrice !== undefined
      ) {
        setIsLoadingTotalVolume(false)
        return
      }

      try {
        setIsLoadingTotalVolume(true)
        const [swapVolumeResponse, ethPriceResponse] = await Promise.all([
          fetch("/api/analytics/volume/swap"),
          fetch("/api/analytics/eth-price"),
        ])

        if (!swapVolumeResponse.ok || !ethPriceResponse.ok) {
          console.error("Failed to fetch total volume data")
          return
        }

        const swapVolumeData = await swapVolumeResponse.json()
        const ethPriceData = await ethPriceResponse.json()

        if (
          swapVolumeData.success &&
          swapVolumeData.cumulativeSwapVolEth !== null &&
          swapVolumeData.cumulativeSwapVolEth !== undefined
        ) {
          setSwapVolumeEth(Number(swapVolumeData.cumulativeSwapVolEth))
        }

        if (
          ethPriceData.success &&
          ethPriceData.ethPrice !== null &&
          ethPriceData.ethPrice !== undefined
        ) {
          setEthPrice(Number(ethPriceData.ethPrice))
        }
      } catch (error) {
        console.error("Error fetching total volume:", error)
      } finally {
        setIsLoadingTotalVolume(false)
      }
    }

    const fetchLeaderboard = async () => {
      // Skip fetching if we already have preloaded data
      if (preloadedData && preloadedData.success) {
        setIsLoadingLeaderboard(false)
        return
      }

      try {
        setIsLoadingLeaderboard(true)
        const url = currentUserAddress
          ? `/api/analytics/leaderboard?currentUser=${currentUserAddress}`
          : "/api/analytics/leaderboard"

        const response = await fetch(url)

        if (!response.ok) {
          console.error("Failed to fetch leaderboard:", response.statusText)
          return
        }

        const data = await response.json()

        if (data.success) {
          const leaderboard = data.leaderboard || []
          setLeaderboardData(leaderboard)
          setUserPosition(data.userPosition || null)
          setUserVolume(data.userVolume || null)
          setNextRankVolume(data.nextRankVolume || null)

          // Debug logging
          console.log("Leaderboard API Response:", {
            userPosition: data.userPosition,
            userVolume: data.userVolume,
            nextRankVolume: data.nextRankVolume,
            volumeDifference:
              data.nextRankVolume && data.userVolume ? data.nextRankVolume - data.userVolume : null,
          })

          // Log leaderboard data to console as a table
          console.table(
            leaderboard.map((entry) => ({
              Rank: entry.rank,
              Wallet: entry.wallet,
              "Total Volume (USD)": `$${entry.swapVolume24h.toLocaleString()}`,
              "24h Change": `${entry.change24h >= 0 ? "+" : ""}${entry.change24h.toFixed(2)}%`,
              "Is Current User": entry.isCurrentUser ? "Yes" : "No",
            }))
          )
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error)
      } finally {
        setIsLoadingLeaderboard(false)
      }
    }

    // Fetch all data in parallel for faster loading
    Promise.all([fetchActiveTraders(), fetchTotalVolume(), fetchLeaderboard()]).catch((error) => {
      console.error("Error fetching leaderboard data:", error)
    })
  }, [
    currentUserAddress,
    preloadedData,
    preloadedActiveTraders,
    preloadedSwapVolumeEth,
    preloadedEthPrice,
  ])

  // Use real leaderboard data only
  const displayLeaderboardData = leaderboardData
  const currentUser = displayLeaderboardData.find((entry) => entry.isCurrentUser)

  // Calculate volume to next rank using the API-provided value
  const volumeToNextRank =
    userPosition && userPosition > 1 && nextRankVolume !== null && userVolume !== null
      ? nextRankVolume - userVolume
      : null

  // Format volume difference with appropriate precision for small values
  const formatVolumeDifference = (volume: number): string => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(2)}K`
    }
    if (volume >= 1) {
      return `$${volume.toFixed(2)}`
    }
    // For values less than $1, show more precision
    if (volume >= 0.01) {
      return `$${volume.toFixed(2)}`
    }
    // For very small values, show up to 6 decimal places
    return `$${volume.toFixed(6).replace(/\.?0+$/, "")}`
  }

  // Calculate total volume in USD (swap volume in ETH * ETH price)
  const totalVolumeUsd =
    swapVolumeEth !== null && ethPrice !== null ? swapVolumeEth * ethPrice : null

  // Use real user position and volume only
  const displayUserPosition = userPosition
  const displayUserVolume = userVolume

  const getRankBadge = (rank: number) => {
    if (rank === 1)
      return (
        <div className="flex items-center gap-1.5">
          <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <span className="font-mono text-sm font-semibold text-yellow-500">#{rank}</span>
        </div>
      )
    if (rank === 2)
      return (
        <div className="flex items-center gap-1.5">
          <Trophy className="w-5 h-5 text-gray-400 fill-gray-400" />
          <span className="font-mono text-sm font-semibold text-gray-400">#{rank}</span>
        </div>
      )
    if (rank === 3)
      return (
        <div className="flex items-center gap-1.5">
          <Trophy className="w-5 h-5 text-amber-600 fill-amber-600" />
          <span className="font-mono text-sm font-semibold text-amber-600">#{rank}</span>
        </div>
      )
    return <span className="font-mono text-sm font-medium text-muted-foreground">#{rank}</span>
  }

  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
          Swap Volume Leaderboard
        </h1>
        <p className="text-muted-foreground text-lg">Top traders ranked by total swap volume</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="p-6 bg-gradient-to-br from-card/90 to-card/50 border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground/80">
                <Users className="w-4 h-4" />
                <p className="text-sm font-medium">Active Traders</p>
              </div>
              <p className="text-3xl font-bold tracking-tight">
                {isLoadingActiveTraders || activeTraders === null ? (
                  <span className="text-muted-foreground">...</span>
                ) : (
                  activeTraders.toLocaleString()
                )}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-card/90 to-card/50 border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground/80">
                <DollarSign className="w-4 h-4" />
                <p className="text-sm font-medium">Total Volume</p>
              </div>
              <p className="text-3xl font-bold tracking-tight">
                {isLoadingTotalVolume || totalVolumeUsd === null ? (
                  <span className="text-muted-foreground">...</span>
                ) : (
                  formatVolume(totalVolumeUsd)
                )}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-primary/15 to-primary/8 border-primary/40 hover:border-primary/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary/90">
                <Award className="w-4 h-4" />
                <p className="text-sm font-medium">Your Position</p>
              </div>
              <p className="text-3xl font-bold tracking-tight text-primary">
                {isLoadingLeaderboard || displayUserPosition === null ? (
                  <span className="text-muted-foreground">...</span>
                ) : (
                  <>{displayUserPosition}</>
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Encouragement Message */}
      {currentUser && displayUserPosition && (
        <Card className="p-5 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/30 backdrop-blur-sm shadow-md">
          <div className="flex items-center gap-3">
            {displayUserPosition === 1 ? (
              <>
                <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                <p className="text-sm font-medium">
                  🎉 Congratulations! You're ranked{" "}
                  <span className="font-semibold text-primary">#1</span> on the leaderboard!
                </p>
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium">
                  {volumeToNextRank !== null && volumeToNextRank > 0 ? (
                    <>
                      You're{" "}
                      <span className="font-semibold text-primary">
                        {formatVolumeDifference(volumeToNextRank)}
                      </span>{" "}
                      away from reaching rank{" "}
                      <span className="font-semibold text-primary">#{displayUserPosition - 1}</span>
                    </>
                  ) : (
                    <>
                      Keep swapping to climb from rank{" "}
                      <span className="font-semibold text-primary">#{displayUserPosition}</span> to
                      rank{" "}
                      <span className="font-semibold text-primary">#{displayUserPosition - 1}</span>
                      !
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Leaderboard Table */}
      <Card className="p-0 bg-card/50 border-border/40 overflow-hidden backdrop-blur-sm shadow-lg">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 bg-gradient-to-r from-muted/30 to-muted/10">
                <th className="text-left py-5 px-6 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  Rank
                </th>
                <th className="text-left py-5 px-6 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  Wallet Address
                </th>
                <th className="text-right py-5 px-6 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  Total Swap Volume
                </th>
                <th className="text-right py-5 px-6 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  24h Change
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoadingLeaderboard ? (
                <tr>
                  <td colSpan={4} className="py-8 px-6 text-center text-muted-foreground">
                    Loading leaderboard...
                  </td>
                </tr>
              ) : displayLeaderboardData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-6 text-center text-muted-foreground">
                    No leaderboard data available
                  </td>
                </tr>
              ) : (
                displayLeaderboardData.map((entry, index) => (
                  <tr
                    key={entry.rank}
                    className={`border-b border-border/20 transition-all duration-200 ${
                      entry.isCurrentUser
                        ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border-l-2 border-l-primary"
                        : "hover:bg-muted/20"
                    } ${index === displayLeaderboardData.length - 1 ? "border-b-0" : ""}`}
                  >
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">{getRankBadge(entry.rank)}</div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-sm font-medium">
                          {formatWalletAddress(entry.wallet)}
                        </span>
                        {entry.isCurrentUser && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0.5 bg-primary/10 border-primary/40 text-primary font-medium"
                          >
                            You
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <span className="font-mono text-sm font-semibold">
                        {formatVolume(entry.swapVolume24h)}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {entry.change24h >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <TrendingUp className="w-3.5 h-3.5 text-destructive rotate-180" />
                        )}
                        <span
                          className={`font-mono text-sm font-medium ${
                            entry.change24h >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {formatChange24h(entry.change24h)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-4 space-y-4">
          {isLoadingLeaderboard ? (
            <Card className="p-6 bg-card/50 border-border/30">
              <div className="text-center text-muted-foreground">Loading leaderboard...</div>
            </Card>
          ) : displayLeaderboardData.length === 0 ? (
            <Card className="p-6 bg-card/50 border-border/30">
              <div className="text-center text-muted-foreground">No leaderboard data available</div>
            </Card>
          ) : (
            displayLeaderboardData.map((entry) => (
              <Card
                key={entry.rank}
                className={`p-5 border transition-all duration-300 ${
                  entry.isCurrentUser
                    ? "bg-gradient-to-r from-primary/20 to-primary/5 border-primary/50 shadow-lg shadow-primary/10"
                    : "bg-card/60 border-border/30 hover:border-primary/40 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-border/20">
                  <div className="flex items-center gap-3">
                    {getRankBadge(entry.rank)}
                    <span className="font-mono text-sm font-medium text-foreground/90">
                      {formatWalletAddress(entry.wallet)}
                    </span>
                  </div>
                  {entry.isCurrentUser && (
                    <Badge
                      variant="outline"
                      className="text-xs px-2.5 py-1 bg-primary/15 border-primary/50 text-primary font-semibold shadow-sm"
                    >
                      You
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wider">
                      Total Swap Volume
                    </p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      {formatVolume(entry.swapVolume24h)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wider text-right">
                      24h Change
                    </p>
                    <div className="flex items-center justify-end gap-1.5">
                      {entry.change24h >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-success/90" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-destructive/90 rotate-180" />
                      )}
                      <span
                        className={`font-mono font-semibold text-lg ${
                          entry.change24h >= 0 ? "text-success/90" : "text-destructive/90"
                        }`}
                      >
                        {formatChange24h(entry.change24h)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
