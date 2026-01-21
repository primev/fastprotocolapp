/**
 * Constants for swap functionality
 */

/**
 * Permit2 contract address (same on all chains)
 */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const

/**
 * FastSettlementV3 contract address
 * TODO: Replace with actual deployed address
 */
export const FAST_SETTLEMENT_ADDRESS = "0x0000000000000000000000000000000000000000" as const

/**
 * Zero address (native ETH placeholder)
 */
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const

/**
 * WETH address on Ethereum mainnet
 */
export const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const

/**
 * Intent Deadline Configuration (2026 Standards)
 *
 * Following Uniswap v4 & Permit2 recommendations:
 * - Standard buffer: 20-30 minute window
 * - Never use block.timestamp or type(uint256).max
 * - Calculated as relative offset from user's local time
 *
 * This deadline is enforced by Permit2 and the Settler contract.
 * If a relayer attempts execution after this timestamp, the transaction will revert.
 */
export const INTENT_DEADLINE_MINUTES = 30 // 30 minutes (Uniswap recommended standard)

/**
 * Token symbol constants for formatting and classification
 */
export const SWAP_CONSTANTS = {
  /**
   * Stablecoin symbols that should be formatted with 2 decimal places
   */
  STABLECOIN_SYMBOLS: ["USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX", "USDP", "LUSD"] as const,

  /**
   * Major asset symbols that should be formatted with 4-6 decimal places
   */
  MAJOR_ASSET_SYMBOLS: ["ETH", "WBTC", "BTC"] as const,
} as const

// Export individual constants for convenience
export const STABLECOIN_SYMBOLS = SWAP_CONSTANTS.STABLECOIN_SYMBOLS
export const MAJOR_ASSET_SYMBOLS = SWAP_CONSTANTS.MAJOR_ASSET_SYMBOLS
