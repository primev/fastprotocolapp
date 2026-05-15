/** Swap-related addresses and config */
import { STABLECOIN_SYMBOLS as STABLECOIN_SYMBOLS_LIST } from "@/lib/stablecoins"

export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const
export const FAST_SETTLEMENT_ADDRESS = "0x084C0EC7f5C0585195c1c713ED9f06272F48cB45" as const
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const
// Executor wallet that submits permit-path swaps and pays sweep gas + bid.
// Sourced from `FastSettlementV3.executor()` on-chain. Used by the miles
// estimator cron to identify executor sweep rows when pricing sweep bids;
// if this ever changes, mirror the new address in
// `mev-commit/tools/fastswap-miles` via redeploy and update here.
export const FAST_SETTLEMENT_EXECUTOR_ADDRESS =
  "0x959dad78d5b68986a43cd270134a2704a990aa68" as const

export const INTENT_DEADLINE_MINUTES = 30

export const SWAP_CONSTANTS = {
  MAJOR_ASSET_SYMBOLS: ["ETH", "WBTC", "BTC"] as const,
} as const

export const STABLECOIN_SYMBOLS = STABLECOIN_SYMBOLS_LIST
export const MAJOR_ASSET_SYMBOLS = SWAP_CONSTANTS.MAJOR_ASSET_SYMBOLS
