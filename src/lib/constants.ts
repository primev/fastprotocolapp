/**
 * Video URLs for wallet setup instructions
 */
export const METAMASK_VIDEO_URL =
  "https://harlequin-electric-albatross-804.mypinata.cloud/ipfs/bafybeiazio37i4chbuw5zsbqpcivcdf3m4y26iat3s7lmleoltjyfqp2qi"
export const RABBY_VIDEO_URL =
  "https://harlequin-electric-albatross-804.mypinata.cloud/ipfs/bafybeid6zj5age6b36s4mxq3e63sivirtdci55lyy3364qly4mswz2daxa"
export const MINT_ASSET_URI =
  "https://harlequin-electric-albatross-804.mypinata.cloud/ipfs/bafybeig5fzfgmljyaleqgyevdyrxmqvocoxtcfrwdkb3uocy5xniciveti"

export const ETHERSCAN_URL =
  "https://etherscan.io/address/0xd0E132C73C9425072AAB9256d63aa14D798D063A"
export const OPENSEA_URL = "https://opensea.io/collection/fast-protocol-genesis-sbt"

export const DISCORD_INVITE_URL = "https://discord.com/invite/fastprotocol"
export const TELEGRAM_INVITE_URL = "https://t.me/Fast_Protocol"
export const TWITTER_INVITE_URL = "https://x.com/Fast_Protocol"

/**
 * Default ETH price in USD to use as fallback when live price is unavailable
 */
export const DEFAULT_ETH_PRICE_USD = 3000

/**
 * Tier thresholds for leaderboard rankings
 */
export const TIER_THRESHOLDS = {
  GOLD: 1_000_000,
  SILVER: 100_000,
  BRONZE: 10_000,
} as const

export type Tier = "gold" | "silver" | "bronze" | "standard"

export interface TierMetadata {
  label: string
  color: string
  dot: string
}

/**
 * Gets the tier based on volume
 */
export function getTierFromVolume(volume: number | null | undefined): Tier {
  if (!volume) return "standard"
  if (volume >= TIER_THRESHOLDS.GOLD) return "gold"
  if (volume >= TIER_THRESHOLDS.SILVER) return "silver"
  if (volume >= TIER_THRESHOLDS.BRONZE) return "bronze"
  return "standard"
}

/**
 * Gets metadata for a tier (styling information)
 */
export function getTierMetadata(tier: string): TierMetadata {
  switch (tier.toLowerCase()) {
    case "gold":
      return { label: "Gold", color: "text-yellow-500", dot: "bg-yellow-500" }
    case "silver":
      return { label: "Silver", color: "text-slate-400", dot: "bg-slate-400" }
    case "bronze":
      return { label: "Bronze", color: "text-amber-600", dot: "bg-amber-600" }
    default:
      return {
        label: "Standard",
        color: "text-muted-foreground/30",
        dot: "bg-muted-foreground/20",
      }
  }
}

/**
 * Gets the next tier threshold value based on current volume
 */
export function getNextTier(volume: number | null | undefined): number {
  const vol = volume || 0
  if (vol < TIER_THRESHOLDS.BRONZE) return TIER_THRESHOLDS.BRONZE
  if (vol < TIER_THRESHOLDS.SILVER) return TIER_THRESHOLDS.SILVER
  return TIER_THRESHOLDS.GOLD
}
