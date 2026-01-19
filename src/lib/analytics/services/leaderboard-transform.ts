import type { LeaderboardRow } from "./leaderboard.service"

/**
 * Helper function to trim wallet address to format: 0x1234...5678
 */
export function trimWalletAddress(address: string): string {
  if (!address || address.length < 8) {
    return address
  }
  // If already trimmed (contains "..."), return as-is
  if (address.includes("...")) {
    return address
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

/**
 * Transformed leaderboard entry
 */
export interface TransformedLeaderboardEntry {
  rank: number
  wallet: string
  swapVolume24h: number
  swapCount: number
  change24h: number
  isCurrentUser: boolean
}

/**
 * Transform raw leaderboard rows into formatted entries
 * @param rows Raw leaderboard rows from database
 * @param ethPrice ETH price for USD conversion
 * @param currentUserAddress Optional current user address for isCurrentUser flag
 * @param useTotalVolume If true, uses total_swap_vol_eth; if false, uses swap_vol_eth_24h
 */
export function transformLeaderboardRows(
  rows: LeaderboardRow[],
  ethPrice: number | null,
  currentUserAddress?: string | null,
  useTotalVolume: boolean = true
): TransformedLeaderboardEntry[] {
  const currentUserLower = currentUserAddress?.toLowerCase() || null

  return rows.map((row, index) => {
    const wallet = row[0]
    const walletLower = wallet?.toLowerCase() || wallet
    const totalSwapVolEth = Number(row[1]) || 0
    const swapCount = Number(row[2]) || 0
    const swapVolEth24h = Number(row[3]) || 0
    const change24hPct = Number(row[4]) || 0

    // Use total volume or 24h volume based on parameter
    const volumeEth = useTotalVolume ? totalSwapVolEth : swapVolEth24h

    // Convert volume to USD
    const volumeUsd = ethPrice !== null ? volumeEth * ethPrice : volumeEth

    return {
      rank: index + 1,
      wallet: trimWalletAddress(walletLower),
      swapVolume24h: volumeUsd,
      swapCount: swapCount,
      change24h: change24hPct,
      isCurrentUser: currentUserLower ? walletLower === currentUserLower : false,
    }
  })
}
