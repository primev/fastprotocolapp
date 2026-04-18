import tokenList from "@/lib/tokens/token-list.json"
import type { Token } from "@/types/swap"
import { POPULAR_TOKEN_ADDRESSES, SUGGESTED_CHIP_SYMBOLS } from "@/lib/tokens/popular-tokens"

/**
 * Build the three token lists rendered by the selector. `excludeAddress`
 * is the lowercased contract address of the token selected on the OTHER
 * side of the swap — it gets filtered out of every list so the same token
 * can't be picked twice. We intentionally match by address rather than by
 * symbol so a barter-map token outside the curated 332 can still exclude
 * itself from the curated/popular lists on the other side.
 */
export const getTokenLists = (excludeAddress: string | null) => {
  const tokens = tokenList as Token[]

  const uniqueTokens = tokens.reduce((acc, token) => {
    const key = token.address.toLowerCase()
    if (!acc.has(key)) {
      acc.set(key, token)
    }
    return acc
  }, new Map<string, Token>())

  const deduplicatedTokens = Array.from(uniqueTokens.values())

  const isExcluded = (t: Token) =>
    excludeAddress != null && t.address.toLowerCase() === excludeAddress

  // Top chip row — ordered exactly as Uniswap renders it.
  const suggestedChips = SUGGESTED_CHIP_SYMBOLS.map((sym) =>
    deduplicatedTokens.find((t) => t.symbol === sym)
  ).filter((t): t is Token => !!t && !isExcluded(t))

  // "Popular tokens" section — curated blue-chip list, ordered by the
  // POPULAR_TOKEN_ADDRESSES array so the UI order is intentional.
  const byAddress = new Map(deduplicatedTokens.map((t) => [t.address.toLowerCase(), t] as const))
  const popularTokens = POPULAR_TOKEN_ADDRESSES.map((addr) =>
    byAddress.get(addr.toLowerCase())
  ).filter((t): t is Token => !!t && !isExcluded(t))

  const allTokens = deduplicatedTokens.filter((token) => !isExcluded(token))

  return {
    suggestedChips,
    popularTokens,
    allTokens,
  }
}
