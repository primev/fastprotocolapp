/**
 * Token icon resolution — progressive fallback chain.
 *
 * For tokens in our curated Uniswap token list the `logoURI` is always used
 * verbatim — no fallbacks needed, those icons are authoritative.
 *
 * For tokens discovered from the barter map (which has no `logoURI`), we
 * walk a chain of public icon CDNs in order of coverage:
 *
 *   1. TrustWallet assets CDN    (~4–5k, keyed by EIP-55 checksum addr —
 *                                 preferred for image quality)
 *   2. DeFiLlama icons CDN       (~15k ERC-20s, aggregates multiple upstreams)
 *   3. 1inch token list CDN      (~5–8k, flat bucket keyed by lowercased addr)
 *
 * The caller walks `tokenIconCandidates(token)` by index, advancing on image
 * error, until either a candidate loads or the list is exhausted (in which
 * case the caller should render a text avatar).
 *
 * See: https://github.com/Uniswap/interface (AssetLogo / CurrencyLogo)
 *      https://icons.llamao.fi  (DeFiLlama icons service)
 *      https://tokens.1inch.io  (1inch flat bucket)
 *      https://github.com/trustwallet/assets
 */

import { getAddress } from "viem"
import { mainnet } from "wagmi/chains"
import { ZERO_ADDRESS } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"

const NATIVE_ETH_ICON = "https://token-icons.s3.amazonaws.com/eth.png"

function defillamaUrl(address: string): string {
  return `https://icons.llamao.fi/icons/tokens/${mainnet.id}/${address.toLowerCase()}?h=48&w=48`
}

function oneInchUrl(address: string): string {
  return `https://tokens.1inch.io/${address.toLowerCase()}.png`
}

function trustWalletUrl(address: string): string | null {
  try {
    const checksum = getAddress(address)
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${checksum}/logo.png`
  } catch {
    return null
  }
}

/**
 * Return an ordered list of candidate icon URLs to try for a token.
 * The first candidate that successfully loads wins; the caller advances
 * through the list on image error until one resolves or all are exhausted.
 *
 * IMPORTANT: When a token has a `logoURI` (i.e. it came from our curated
 * Uniswap-sourced list), we return ONLY that URL — no fallbacks. Curated
 * icons are authoritative and we never want to silently swap them out for
 * a different source's version.
 */
export function tokenIconCandidates(token: Pick<Token, "address" | "logoURI">): string[] {
  // Native ETH — always use the canonical static icon.
  if (!token.address || token.address.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return [NATIVE_ETH_ICON]
  }

  // Curated list entries: trust the logoURI, no fallback chain.
  if (token.logoURI) return [token.logoURI]

  // Long-tail barter tokens: walk the public CDN fallback chain.
  // TrustWallet is preferred (highest image quality) with DeFiLlama and
  // 1inch as back-fills for tokens TrustWallet doesn't have.
  const candidates: string[] = []
  const tw = trustWalletUrl(token.address)
  if (tw) candidates.push(tw)
  candidates.push(defillamaUrl(token.address))
  candidates.push(oneInchUrl(token.address))
  return candidates
}

/**
 * Legacy single-URL resolver — returns the first candidate. Kept for callers
 * that don't need fallback walking (e.g. static rendering, tests).
 */
export function tokenIconUrl(token: Pick<Token, "address" | "logoURI">): string | null {
  const candidates = tokenIconCandidates(token)
  return candidates[0] ?? null
}
