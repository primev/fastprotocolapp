/**
 * Token resolution utilities for swap functionality
 * Handles token address and decimal resolution from token list
 */

import type { Address } from "viem"
import type { Token } from "@/types/swap"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"

/**
 * Resolve token address for quoting
 * - If token object provided, use its address
 * - If symbol provided, lookup in token list
 * - Handle ETH → WETH conversion (Uniswap uses WETH for quoting)
 *
 * @param token - Token object or symbol string
 * @param tokenList - List of available tokens for fallback lookup
 * @returns Resolved token address or null if not found
 */
export function resolveTokenAddress(
  token: Token | string | undefined | null,
  tokenList: Token[] = []
): Address | null {
  if (!token) return null

  // If token object provided, use its address directly
  if (typeof token === "object" && token.address) {
    // Handle native ETH (zero address) → convert to WETH for quoting
    if (token.address === ZERO_ADDRESS || token.symbol?.toUpperCase() === "ETH") {
      return WETH_ADDRESS
    }
    return token.address as Address
  }

  // If symbol string provided, lookup in token list
  if (typeof token === "string") {
    const symbol = token.toUpperCase()

    // Handle ETH symbol → convert to WETH
    if (symbol === "ETH") {
      return WETH_ADDRESS
    }

    // Lookup in token list
    const foundToken = tokenList.find((t) => t.symbol.toUpperCase() === symbol)

    if (foundToken) {
      // Still convert zero address to WETH
      if (foundToken.address === ZERO_ADDRESS) {
        return WETH_ADDRESS
      }
      return foundToken.address as Address
    }
  }

  return null
}

/**
 * Resolve token decimals
 * - If token object provided, use its decimals
 * - If symbol provided, lookup in token list
 * - Default to 18 if not found (most ERC20 tokens use 18 decimals)
 *
 * @param token - Token object or symbol string
 * @param tokenList - List of available tokens for fallback lookup
 * @returns Token decimals (defaults to 18)
 */
export function resolveTokenDecimals(
  token: Token | string | undefined | null,
  tokenList: Token[] = []
): number {
  if (!token) return 18

  // If token object provided, use its decimals
  if (typeof token === "object" && typeof token.decimals === "number") {
    return token.decimals
  }

  // If symbol string provided, lookup in token list
  if (typeof token === "string") {
    const symbol = token.toUpperCase()
    const foundToken = tokenList.find((t) => t.symbol.toUpperCase() === symbol)

    if (foundToken && typeof foundToken.decimals === "number") {
      return foundToken.decimals
    }
  }

  // Default to 18 decimals (most common)
  return 18
}

/**
 * Check if a token is native ETH
 */
export function isNativeETH(token: Token | string | undefined | null): boolean {
  if (!token) return false

  if (typeof token === "object") {
    return token.address === ZERO_ADDRESS || token.symbol?.toUpperCase() === "ETH"
  }

  if (typeof token === "string") {
    return token.toUpperCase() === "ETH"
  }

  return false
}

/**
 * Get token symbol from token object or string
 */
export function getTokenSymbol(token: Token | string | undefined | null): string | null {
  if (!token) return null

  if (typeof token === "object") {
    return token.symbol || null
  }

  if (typeof token === "string") {
    return token
  }

  return null
}
