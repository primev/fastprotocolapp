import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { STABLECOIN_SYMBOLS, MAJOR_ASSET_SYMBOLS } from "@/lib/swap-constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number with K (thousands), M (millions), and B (billions) suffixes
 * @param value - The number to format
 * @param options - Optional formatting options
 * @returns Formatted string (e.g., "1.5K", "2.3M", "1B", "1,234")
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: {
    maximumFractionDigits?: number
    minimumFractionDigits?: number
  }
): string {
  if (value === null || value === undefined) {
    return "0"
  }

  const num = typeof value === "string" ? Number(value) : value

  if (isNaN(num)) {
    return "0"
  }

  // Intl.NumberFormat with "compact" notation (modern browsers) uses "K", "M", "B" for billions
  // But some environments may use "G" or local-specific; optionally handle "B" mapping for consistency.
  let str = num.toLocaleString(undefined, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: options?.maximumFractionDigits ?? 1,
    minimumFractionDigits: options?.minimumFractionDigits,
  })

  // Guarantee 'B' for billions if some locales use 'G'
  if (/([0-9.]+)G$/i.test(str)) {
    str = str.replace(/G$/i, "B")
  }

  return str
}

/**
 * Formats a number as currency with $ prefix using formatNumber
 * @param value - The number to format
 * @param options - Optional formatting options
 * @returns Formatted currency string (e.g., "$1.5K", "$2.3M", "$1B")
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options?: {
    maximumFractionDigits?: number
    minimumFractionDigits?: number
  }
): string {
  return `$${formatNumber(value, options)}`
}

/**
 * Formats a wallet address to show first and last few characters
 * @param address - The wallet address to format
 * @param startChars - Number of characters to show at start (default: 4)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Formatted address (e.g., "0x12...abcd")
 */
export function formatWalletAddress(
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (!address || address.length < startChars + endChars) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Check if a token symbol is a stablecoin
 * @param symbol - Token symbol to check
 * @returns True if the symbol is a stablecoin
 */
export function isStablecoin(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.includes(symbol.toUpperCase() as (typeof STABLECOIN_SYMBOLS)[number])
}

/**
 * Sanitize and validate amount input
 * @param input - Raw input string
 * @returns Sanitized number or null if invalid
 */
export function sanitizeAmountInput(input: string): number | null {
  if (!input || typeof input !== "string") return null

  // Remove any non-numeric characters except decimal point
  const sanitized = input.replace(/[^0-9.]/g, "")

  // Ensure only one decimal point
  const parts = sanitized.split(".")
  const cleanedAmount = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : sanitized

  const num = parseFloat(cleanedAmount)

  // Validate the number
  if (isNaN(num) || num < 0 || !isFinite(num)) return null

  // Reject numbers that are too large (potential overflow)
  if (num > Number.MAX_SAFE_INTEGER) return null

  return num
}

/**
 * Formats token amount for display based on token type
 * Handles different token types with appropriate decimal precision
 * @param amount - Amount to format (string or number)
 * @param tokenSymbol - Optional token symbol to determine formatting rules
 * @param maxDecimals - Optional maximum decimals override (default: auto-detect)
 * @returns Formatted amount string
 */
export function formatTokenAmount(
  amount: string | number,
  tokenSymbol?: string,
  maxDecimals?: number
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount

  if (isNaN(num) || num === 0) return "0"

  const symbol = tokenSymbol?.toUpperCase() || ""

  // For very small numbers (< 0.001): use significant digits
  if (num < 0.000001) return "<0.000001"
  if (num < 0.001) {
    return num.toLocaleString("en-US", {
      maximumSignificantDigits: 6,
      notation: "standard",
    })
  }

  // Stablecoins: 2 decimals
  if (STABLECOIN_SYMBOLS.includes(symbol)) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num)
  }

  // Major assets: 4-6 decimals based on value
  if (MAJOR_ASSET_SYMBOLS.includes(symbol)) {
    const decimals = num >= 1 ? 4 : 6
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    }).format(num)
  }

  // Default: 4-6 decimals based on value, or use provided maxDecimals
  if (maxDecimals !== undefined) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: maxDecimals,
      minimumFractionDigits: 0,
    }).format(num)
  }

  const decimals = num >= 1 ? 4 : 6
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(num)
}

/**
 * Formats a balance for display
 * @param balanceValue - Balance value as number
 * @param tokenSymbol - Token symbol for formatting rules
 * @returns Formatted balance string
 */
export function formatBalance(balanceValue: number, tokenSymbol?: string): string {
  if (balanceValue <= 0) return "0"
  return formatTokenAmount(balanceValue, tokenSymbol)
}
