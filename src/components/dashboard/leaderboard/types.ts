// Shared types for the dashboard leaderboard. Extracted from
// LeaderboardTable so the top-level leaderboard card components under this
// folder can import them without pulling in the parent orchestrator file.

export interface LeaderboardEntry {
  wallet: string
  rank: number
  swapVolume24h: number
  swapCount?: number
  change24h: number
  isCurrentUser?: boolean
  ethValue?: number
}

export interface LeaderboardData {
  success: boolean
  leaderboard?: LeaderboardEntry[]
  userVolume?: number | null
  userPosition?: number | null
  nextRankVolume?: number | null
}

export interface LeaderboardStats {
  activeTraders: number | null
  swapVolumeEth: number | null
  swapVolumeUsd: number | null
}
