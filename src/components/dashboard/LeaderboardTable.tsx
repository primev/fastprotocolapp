"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, Users, DollarSign, Award } from "lucide-react"

interface LeaderboardEntry {
  rank: number
  wallet: string
  swapVolume24h: number // 24h swap volume in USD
  change24h: number // 24h change percentage
  isCurrentUser?: boolean
}

// Mock stats data
const mockStats = {
  activeTraders: 1247,
  totalVolume: 9800000, // $9.8M in USD
  userPosition: 42,
  userVolume: 185000, // $185K in USD
  nextRankVolume: 200000, // $200K - volume needed for rank #40
}

const mockLeaderboardData: LeaderboardEntry[] = [
  {
    rank: 1,
    wallet: "0xabc1234567890123456789012345678901234567",
    swapVolume24h: 1250000, // $1250K
    change24h: 15,
  },
  {
    rank: 2,
    wallet: "0xdef4567890123456789012345678901234567890",
    swapVolume24h: 980000, // $980K
    change24h: 12,
  },
  {
    rank: 3,
    wallet: "0x789def0123456789012345678901234567890123",
    swapVolume24h: 850000, // $850K
    change24h: 8,
  },
  {
    rank: 4,
    wallet: "0x1f5a4d8901234567890123456789012345678901",
    swapVolume24h: 720000,
    change24h: 5,
  },
  {
    rank: 5,
    wallet: "0x8e2c9b3401234567890123456789012345678902",
    swapVolume24h: 650000,
    change24h: -2,
  },
  {
    rank: 6,
    wallet: "0xa1b2c3d4e5f6789012345678901234567890123",
    swapVolume24h: 580000,
    change24h: 7,
  },
  {
    rank: 7,
    wallet: "0xf1e2d3c4b5a6789012345678901234567890123",
    swapVolume24h: 520000,
    change24h: 4,
  },
  {
    rank: 8,
    wallet: "0x1234567890abcdef1234567890abcdef123456",
    swapVolume24h: 480000,
    change24h: -1,
  },
  {
    rank: 9,
    wallet: "0x9876543210fedcba9876543210fedcba987654",
    swapVolume24h: 440000,
    change24h: 6,
  },
  {
    rank: 10,
    wallet: "0xabcdef1234567890abcdef1234567890abcdef",
    swapVolume24h: 400000,
    change24h: 3,
  },
  {
    rank: 11,
    wallet: "0xfedcba0987654321fedcba0987654321fedcba",
    swapVolume24h: 370000,
    change24h: 2,
  },
  {
    rank: 12,
    wallet: "0x1111222233334444555566667777888899990000",
    swapVolume24h: 340000,
    change24h: -3,
  },
  {
    rank: 13,
    wallet: "0x2222333344445555666677778888999900001111",
    swapVolume24h: 310000,
    change24h: 5,
  },
  {
    rank: 14,
    wallet: "0x3333444455556666777788889999000011112222",
    swapVolume24h: 280000,
    change24h: 1,
  },
  {
    rank: 15,
    wallet: "0x4444555566667777888899990000111122223333",
    swapVolume24h: 250000,
    change24h: -2,
  },
  {
    rank: 42,
    wallet: "0x7a23f9c201234567890123456789012345678903",
    swapVolume24h: 185000, // $185K
    change24h: 3,
    isCurrentUser: true,
  },
]

// Format wallet address with ellipsis (first 4 chars + ... + last 4 chars)
const formatWalletAddress = (address: string): string => {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

// Format volume in USD with K/M notation
const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`
  }
  if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(0)}K`
  }
  return `$${volume.toLocaleString()}`
}

// Format 24h change as percentage
const formatChange24h = (change: number): string => {
  const sign = change >= 0 ? "+" : ""
  return `${sign}${change.toFixed(0)}%`
}

export const LeaderboardTable = () => {
  const currentUser = mockLeaderboardData.find((entry) => entry.isCurrentUser)
  const volumeToNextRank = mockStats.nextRankVolume - mockStats.userVolume

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
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
          Swap Volume Leaderboard
        </h1>
        <p className="text-muted-foreground text-lg">Top traders ranked by 24h swap volume</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <p className="text-sm font-medium">Active Traders</p>
              </div>
              <p className="text-3xl font-bold tracking-tight">
                {mockStats.activeTraders.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                <p className="text-sm font-medium">Total Volume</p>
              </div>
              <p className="text-3xl font-bold tracking-tight">
                {formatVolume(mockStats.totalVolume)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary/80">
                <Award className="w-4 h-4" />
                <p className="text-sm font-medium">Your Position</p>
              </div>
              <p className="text-3xl font-bold tracking-tight text-primary">
                #{mockStats.userPosition} • {formatVolume(mockStats.userVolume)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Encouragement Message */}
      {currentUser && volumeToNextRank > 0 && (
        <Card className="p-5 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm font-medium">
              Keep swapping! You're just <span className="font-semibold text-primary">{formatVolume(volumeToNextRank)}</span> away from reaching rank{" "}
              <span className="font-semibold text-primary">#{mockStats.userPosition - 1}</span>
            </p>
          </div>
        </Card>
      )}

      {/* Leaderboard Table */}
      <Card className="p-0 bg-card/40 border-border/50 overflow-hidden backdrop-blur-sm">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Rank
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Wallet Address
                </th>
                <th className="text-right py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Swap Volume
                </th>
                <th className="text-right py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  24h Change
                </th>
              </tr>
            </thead>
            <tbody>
              {mockLeaderboardData.map((entry, index) => (
                <tr
                  key={entry.rank}
                  className={`border-b border-border/20 transition-all duration-200 ${
                    entry.isCurrentUser
                      ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border-l-2 border-l-primary"
                      : "hover:bg-muted/20"
                  } ${index === mockLeaderboardData.length - 1 ? "border-b-0" : ""}`}
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-4 space-y-3">
          {mockLeaderboardData.map((entry) => (
            <Card
              key={entry.rank}
              className={`p-4 border transition-all duration-200 ${
                entry.isCurrentUser
                  ? "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/40 shadow-lg shadow-primary/5"
                  : "bg-card/50 border-border/50 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getRankBadge(entry.rank)}
                  <span className="font-mono text-sm font-medium">
                    {formatWalletAddress(entry.wallet)}
                  </span>
                </div>
                {entry.isCurrentUser && (
                  <Badge
                    variant="outline"
                    className="text-xs px-2 py-0.5 bg-primary/10 border-primary/40 text-primary font-medium"
                  >
                    You
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Swap Volume</p>
                  <p className="font-mono font-semibold text-base">
                    {formatVolume(entry.swapVolume24h)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">24h Change</p>
                  <div className="flex items-center gap-1.5">
                    {entry.change24h >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 text-destructive rotate-180" />
                    )}
                    <span
                      className={`font-mono font-semibold text-base ${
                        entry.change24h >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatChange24h(entry.change24h)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  )
}
