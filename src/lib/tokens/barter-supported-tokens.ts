/**
 * Lazy loader + lookup for the barter-supported tokens metadata map.
 *
 * This is a ~8 MB JSON (public/data/barter-supported-tokens.json) listing every
 * ERC-20 eligible for barter settlement on Ethereum mainnet. It is NOT bundled —
 * we fetch it once on first use, parse it into a Map keyed by lowercased address,
 * and cache it in-module for the life of the tab.
 *
 * The build-time shrink script (scripts/shrink-barter-tokens.mjs) guarantees:
 *   - keys are already lowercased
 *   - native ETH sentinels (0x00..00, 0xee..ee) are stripped
 *   - each entry has { address, tokenInfo: { name, symbol, decimals } }
 *   - no prices field (USD values are fetched at runtime from CoinGecko)
 */

import type { Token } from "@/types/swap"
import curatedTokenList from "@/lib/tokens/token-list.json"

export interface BarterTokenEntry {
  address: string
  tokenInfo: {
    name: string
    symbol: string
    decimals: number
  }
  /** Populated at load time from the curated Uniswap list when addresses overlap. */
  logoURI?: string
}

type BarterMap = Map<string, BarterTokenEntry>

let cache: BarterMap | null = null
let inflight: Promise<BarterMap> | null = null

/**
 * Lookup of curated Uniswap-list logoURIs keyed by lowercased address. Built
 * lazily on first barter-map load and reused for every subsequent enrichment.
 * Populated from src/lib/token-list.json (the curated 344).
 */
let curatedLogoLookup: Map<string, string> | null = null

function getCuratedLogoLookup(): Map<string, string> {
  if (curatedLogoLookup) return curatedLogoLookup
  const map = new Map<string, string>()
  for (const t of curatedTokenList as Token[]) {
    if (t.address && t.logoURI) {
      map.set(t.address.toLowerCase(), t.logoURI)
    }
  }
  curatedLogoLookup = map
  return map
}

export function loadBarterSupportedTokens(): Promise<BarterMap> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = fetch("/data/barter-supported-tokens.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load barter list: ${r.status}`)
      return r.json() as Promise<Record<string, BarterTokenEntry>>
    })
    .then((obj) => {
      const curatedLogos = getCuratedLogoLookup()
      const map: BarterMap = new Map()
      for (const key of Object.keys(obj)) {
        const entry = obj[key]
        // When an address also appears in the curated Uniswap list, copy the
        // curated logoURI onto the barter entry so the selector uses the
        // authoritative icon instead of walking the public CDN fallback chain.
        const curatedLogo = curatedLogos.get(key)
        if (curatedLogo) entry.logoURI = curatedLogo
        map.set(key, entry)
      }
      cache = map
      inflight = null
      return map
    })
    .catch((err) => {
      inflight = null
      throw err
    })
  return inflight
}

/** Synchronous accessor — returns null until loadBarterSupportedTokens() has resolved at least once. */
export function getBarterMap(): BarterMap | null {
  return cache
}

/** Convert a BarterTokenEntry into our local Token shape (for use in the selector UI). */
export function barterEntryToToken(entry: BarterTokenEntry): Token | null {
  const info = entry.tokenInfo
  if (!info?.symbol || info.decimals == null) return null
  return {
    address: entry.address,
    symbol: info.symbol,
    decimals: Number(info.decimals),
    name: info.name || info.symbol,
    // Carries the curated Uniswap logoURI when the address overlaps with
    // the curated list; undefined otherwise (TokenAvatar will then walk
    // its public CDN fallback chain).
    logoURI: entry.logoURI,
  }
}
