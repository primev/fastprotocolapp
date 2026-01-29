import tokenList from "@/lib/token-list.json"
import type { Token } from "@/types/swap"

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

  const popularTokens = deduplicatedTokens.filter(
    (token) =>
      (!excludeToken || token.symbol !== excludeToken) &&
      ["ETH", "USDC", "USDT", "WBTC", "DAI"].includes(token.symbol)
  )
  const allTokens = deduplicatedTokens.filter(
    (token) => !excludeToken || token.symbol !== excludeToken
  )

  return {
    popularTokens,
    allTokens,
  }
}
