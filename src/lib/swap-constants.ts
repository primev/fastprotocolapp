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
