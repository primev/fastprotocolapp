/**
 * Server-side in-memory cache for Google Sheet data.
 *
 * Shared across all API routes so a single Sheets fetch serves
 * multiple requests on a warm server instance.
 * TTL is intentionally short (2 min) so data stays accurate.
 */

const CACHE_TTL_MS = 2 * 60 * 1000

interface CacheEntry {
  rows: string[][]
  timestamp: number
}

let _waitlistCache: CacheEntry | null = null
let _whitelistCache: CacheEntry | null = null

function read(entry: CacheEntry | null): string[][] | null {
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null
  return entry.rows
}

// ── Waitlist ──────────────────────────────────────────────

export function getWaitlistSheetCache(): string[][] | null {
  return read(_waitlistCache)
}

export function setWaitlistSheetCache(rows: string[][]): void {
  _waitlistCache = { rows, timestamp: Date.now() }
}

export function invalidateWaitlistSheetCache(): void {
  _waitlistCache = null
}

// ── Whitelist ─────────────────────────────────────────────

export function getWhitelistSheetCache(): string[][] | null {
  return read(_whitelistCache)
}

export function setWhitelistSheetCache(rows: string[][]): void {
  _whitelistCache = { rows, timestamp: Date.now() }
}

export function invalidateWhitelistSheetCache(): void {
  _whitelistCache = null
}
