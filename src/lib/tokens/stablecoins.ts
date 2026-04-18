/**
 * Stablecoin detection and list for formatting (toFixed vs toSignificant).
 * CORE_STABLES = mainnet addresses for instant O(1) match.
 * STABLECOIN_SYMBOLS = from CoinGecko (stablecoin-list.json) for symbol-based fallback.
 */

import stablecoinList from "./stablecoin-list.json"

// 1. Define the 'Big Three' for instant matches (Ethereum mainnet)
const CORE_STABLES = new Set(
  [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
  ].map((a) => a.toLowerCase())
)

// 2. Symbol list from CoinGecko (no duplicates), uppercase
export const STABLECOIN_SYMBOLS: readonly string[] = stablecoinList as string[]

const STABLECOIN_SYMBOL_SET = new Set(STABLECOIN_SYMBOLS.map((s) => s.toUpperCase()))

/**
 * Detect if a token is a stablecoin by address (O(1)) or symbol (heuristic + list).
 */
export function isStablecoin(address: string, symbol?: string): boolean {
  const addr = address?.toLowerCase() ?? ""

  // Method A: Check hardcoded list (O(1) speed)
  if (addr && CORE_STABLES.has(addr)) return true

  // Method B: Check CoinGecko symbol list
  if (symbol && STABLECOIN_SYMBOL_SET.has(symbol.toUpperCase())) return true

  // Method C: Heuristic (fallback for unknown tokens with stable-like symbols)
  const commonStablePrefixes = ["USD", "EUR", "DAI", "FRAX"]
  if (symbol && commonStablePrefixes.some((p) => symbol.toUpperCase().startsWith(p))) {
    return true
  }

  return false
}
