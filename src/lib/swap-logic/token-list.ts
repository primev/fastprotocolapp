import tokenList from "@/lib/token-list.json"
import type { Token } from "@/types/swap"
import { POPULAR_TOKEN_ADDRESSES, SUGGESTED_CHIP_SYMBOLS } from "@/lib/popular-tokens"

export const getTokenLists = (excludeToken: string | null) => {
  const tokens = tokenList as Token[]

  const uniqueTokens = tokens.reduce((acc, token) => {
    const key = token.address.toLowerCase()
    if (!acc.has(key)) {
      acc.set(key, token)
    }
    return acc
  }, new Map<string, Token>())

  const deduplicatedTokens = Array.from(uniqueTokens.values())

  // Top chip row — ordered exactly as Uniswap renders it.
  const suggestedChips = SUGGESTED_CHIP_SYMBOLS.map((sym) =>
    deduplicatedTokens.find((t) => t.symbol === sym)
  ).filter((t): t is Token => !!t && (!excludeToken || t.symbol !== excludeToken))

  // "Popular tokens" section — curated blue-chip list, ordered by the
  // POPULAR_TOKEN_ADDRESSES array so the UI order is intentional.
  const byAddress = new Map(deduplicatedTokens.map((t) => [t.address.toLowerCase(), t] as const))
  const popularTokens = POPULAR_TOKEN_ADDRESSES.map((addr) =>
    byAddress.get(addr.toLowerCase())
  ).filter((t): t is Token => !!t && (!excludeToken || t.symbol !== excludeToken))

  const allTokens = deduplicatedTokens.filter(
    (token) => !excludeToken || token.symbol !== excludeToken
  )

  return {
    suggestedChips,
    popularTokens,
    allTokens,
  }
}
