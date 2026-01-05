import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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
