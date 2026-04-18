/**
 * Server-side function to fetch Uniswap token list
 * Fetches from Uniswap's official token list API
 * Can be cached/static as token list changes infrequently
 */

export interface Token {
  address: string
  symbol: string
  decimals: number
  logoURI?: string
  name?: string
}

interface UniswapTokenListResponse {
  tokens: Array<{
    chainId: number
    address: string
    symbol: string
    decimals: number
    logoURI?: string
    name?: string
  }>
}

/**
 * Fetches token list from Uniswap's official token list API
 * Filters for Ethereum mainnet (chainId: 1)
 */
export async function getUniswapTokenList(): Promise<Token[]> {
  try {
    const response = await fetch("https://tokens.uniswap.org", {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      console.error("Failed to fetch Uniswap token list:", response.statusText)
      return []
    }

    const data: UniswapTokenListResponse = await response.json()

    // Filter for Ethereum mainnet (chainId: 1) and map to our Token interface
    const tokens = data.tokens
      .filter((token) => token.chainId === 1)
      .map((token) => ({
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        name: token.name,
      }))

    return tokens
  } catch (error) {
    console.error("Error fetching Uniswap token list:", error)
    return []
  }
}
