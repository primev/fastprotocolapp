"use client"

import { useQuery } from "@tanstack/react-query"
import { useBalance } from "wagmi"
import { formatUnits } from "viem"
import { mainnet } from "wagmi/chains"
import { ZERO_ADDRESS } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"
import { loadBarterSupportedTokens, barterEntryToToken } from "@/lib/barter-supported-tokens"

// Canonical WETH address — used as the CoinGecko lookup key for native ETH.
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"

const NATIVE_ETH_TOKEN: Token = {
  address: ZERO_ADDRESS,
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
  logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
}

// Ethereum mainnet only — this app is not cross-chain.
function alchemyMainnetUrl(): string | undefined {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn(
        "[useHeldTokens] NEXT_PUBLIC_ALCHEMY_API_KEY is not set — held-token discovery is disabled."
      )
    }
    return undefined
  }
  return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
}

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`)
  const json = (await res.json()) as { result?: T; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result as T
}

interface AlchemyTokenBalance {
  contractAddress: string
  tokenBalance: string | null
  error?: string | null
}

interface AlchemyTokenBalancesResult {
  address: string
  tokenBalances: AlchemyTokenBalance[]
  pageKey?: string
}

/**
 * A token the user currently holds, joined with metadata from the barter map
 * and (when available) a USD price from CoinGecko.
 *
 * `sortKey` is `formattedAmount * usdPrice` and is used by the selector to
 * rank Your Tokens by USD value desc. Tokens with no price fall back to 0,
 * so they appear at the bottom of the priced set.
 */
export interface HeldToken {
  token: Token
  rawBalance: bigint
  /** Parsed balance as a JS number, for display + USD math. */
  balance: number
  /** USD spot price per token from CoinGecko, or null if unknown. */
  usdPrice: number | null
  /** balance * usdPrice, or 0 if no price. */
  usdValue: number
  sortKey: number
}

/**
 * Fetch USD spot prices for a set of ERC-20 contract addresses.
 *
 * Primary source: Alchemy's Prices API (`/prices/v1/{key}/tokens/by-address`).
 * We already pay for Alchemy and it uses the same API key as the RPC
 * transport, so this is one network dependency for the whole token-balances
 * feature and it handles CORS / rate limits cleanly.
 *
 * Fallback: DefiLlama's free `coins.llama.fi/prices/current` endpoint — used
 * when `NEXT_PUBLIC_ALCHEMY_API_KEY` is unset (local dev without a key) or
 * when Alchemy returns nothing for a chunk.
 *
 * Returns a Record<addressLower, usd>. Missing prices are simply absent from
 * the map — the caller treats that as "no USD value available".
 */
async function fetchFromAlchemy(
  apiKey: string,
  addresses: string[]
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  // Alchemy caps this endpoint at 25 addresses per request.
  const CHUNK = 25
  for (let i = 0; i < addresses.length; i += CHUNK) {
    const chunk = addresses.slice(i, i + CHUNK).map((a) => a.toLowerCase())
    const url = `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses: chunk.map((address) => ({ network: "eth-mainnet", address })),
        }),
      })
      if (!res.ok) continue
      const json = (await res.json()) as {
        data?: Array<{
          address: string
          prices?: Array<{ currency: string; value: string }>
          error?: unknown
        }>
      }
      for (const entry of json.data ?? []) {
        if (entry.error) continue
        const usd = entry.prices?.find((p) => p.currency.toLowerCase() === "usd")
        if (!usd) continue
        const num = Number(usd.value)
        if (Number.isFinite(num)) {
          prices[entry.address.toLowerCase()] = num
        }
      }
    } catch {
      // Swallow — we'll either fall through to DefiLlama or return partial data.
    }
  }
  return prices
}

async function fetchFromDefiLlama(addresses: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  const CHUNK = 100
  for (let i = 0; i < addresses.length; i += CHUNK) {
    const chunk = addresses.slice(i, i + CHUNK).map((a) => a.toLowerCase())
    const ids = chunk.map((a) => `ethereum:${a}`).join(",")
    const url = `https://coins.llama.fi/prices/current/${ids}`
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const json = (await res.json()) as {
        coins?: Record<string, { price?: number }>
      }
      for (const [key, obj] of Object.entries(json.coins ?? {})) {
        const addr = key.split(":")[1]?.toLowerCase()
        if (addr && typeof obj?.price === "number") prices[addr] = obj.price
      }
    } catch {
      // Swallow.
    }
  }
  return prices
}

async function fetchTokenPrices(addresses: string[]): Promise<Record<string, number>> {
  if (addresses.length === 0) return {}

  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  if (apiKey) {
    const alchemyPrices = await fetchFromAlchemy(apiKey, addresses)
    // Back-fill any addresses Alchemy didn't know about from DefiLlama.
    const missing = addresses.filter((a) => alchemyPrices[a.toLowerCase()] == null)
    if (missing.length === 0) return alchemyPrices
    const llamaPrices = await fetchFromDefiLlama(missing)
    return { ...llamaPrices, ...alchemyPrices }
  }

  return fetchFromDefiLlama(addresses)
}

/**
 * Discovers every non-zero ERC-20 the wallet holds on Ethereum mainnet via
 * Alchemy's `alchemy_getTokenBalances(owner, "erc20")` endpoint, plus native ETH,
 * joins each result against the barter-supported tokens metadata map, fetches
 * USD prices from CoinGecko, and returns them sorted by USD value desc.
 *
 * Tokens the wallet holds that are not in the barter map are dropped — they
 * aren't tradeable through this app, so showing them in the selector would
 * mislead the user.
 */
export function useHeldTokens(owner: `0x${string}` | undefined, chainId: number) {
  const url = chainId === mainnet.id ? alchemyMainnetUrl() : undefined

  return useQuery({
    queryKey: ["held-tokens", chainId, owner],
    enabled: Boolean(url && owner),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async (): Promise<HeldToken[]> => {
      if (!url || !owner) return []

      // Prefetch metadata in parallel with balance discovery.
      const barterMapPromise = loadBarterSupportedTokens().catch((err) => {
        // If the barter map fails to load, we still want to show native ETH,
        // so swallow the error and return an empty map.
        // eslint-disable-next-line no-console
        console.warn("[useHeldTokens] failed to load barter map:", err)
        return new Map()
      })

      // Alchemy's "erc20" mode returns all non-zero balances for this owner
      // in pages of up to 100. Walk pageKey until exhausted.
      // Errors from any single page are swallowed so we still return a partial
      // result rather than losing the whole section.
      const erc20Balances: AlchemyTokenBalance[] = []
      try {
        let pageKey: string | undefined = undefined
        do {
          const params: unknown[] = [owner, "erc20"]
          if (pageKey) params.push({ pageKey })
          const page: AlchemyTokenBalancesResult = await rpcCall(
            url,
            "alchemy_getTokenBalances",
            params
          )
          erc20Balances.push(...page.tokenBalances)
          pageKey = page.pageKey
        } while (pageKey !== undefined)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[useHeldTokens] alchemy_getTokenBalances failed:", err)
      }

      // NOTE: Native ETH is intentionally NOT fetched here. It is merged into
      // Your tokens by the caller using wagmi's useBalance() hook, which
      // routes through the full transport chain (Alchemy → public RPC
      // fallbacks) and keeps ETH discovery working even if this hook is
      // disabled (e.g. missing NEXT_PUBLIC_ALCHEMY_API_KEY).

      const barterMap = await barterMapPromise

      // Join ERC-20 balances against the barter map.
      interface Joined {
        token: Token
        rawBalance: bigint
        balance: number
      }
      const joined: Joined[] = []

      for (const tb of erc20Balances) {
        if (!tb.tokenBalance || tb.error) continue
        let raw: bigint
        try {
          raw = BigInt(tb.tokenBalance)
        } catch {
          continue
        }
        if (raw === 0n) continue

        const entry = barterMap.get(tb.contractAddress.toLowerCase())
        if (!entry) continue // not barter-supported → not tradeable here

        const token = barterEntryToToken(entry)
        if (!token) continue

        joined.push({
          token,
          rawBalance: raw,
          balance: Number(formatUnits(raw, token.decimals)),
        })
      }

      // Fetch USD prices for all held ERC-20s in one batch.
      const priceLookupAddresses = joined.map((j) => j.token.address.toLowerCase())
      const prices = await fetchTokenPrices(priceLookupAddresses)

      const held: HeldToken[] = joined.map((j) => {
        const usdPrice = prices[j.token.address.toLowerCase()] ?? null
        const usdValue = usdPrice ? j.balance * usdPrice : 0
        return {
          token: j.token,
          rawBalance: j.rawBalance,
          balance: j.balance,
          usdPrice,
          usdValue,
          sortKey: usdValue,
        }
      })

      held.sort((a, b) => {
        if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey
        // Tie-break: tokens with any price above tokens with none, then by raw balance desc.
        if ((a.usdPrice != null) !== (b.usdPrice != null)) {
          return a.usdPrice != null ? -1 : 1
        }
        return b.balance - a.balance
      })

      return held
    },
  })
}

/**
 * Native ETH balance as a HeldToken — fetched via wagmi's useBalance() so it
 * works through the full transport chain (Alchemy → public RPC fallbacks),
 * independent of whether useHeldTokens is enabled.
 *
 * Returns null until the balance has loaded or if the wallet holds nothing.
 */
export function useNativeEthHeld(
  owner: `0x${string}` | undefined,
  chainId: number
): HeldToken | null {
  const enabled = Boolean(owner) && chainId === mainnet.id

  const { data: balance } = useBalance({
    address: enabled ? owner : undefined,
    chainId: mainnet.id,
  })

  // Fetch ETH price via WETH's CoinGecko entry. Cached alongside other price
  // queries and cheap to keep fresh.
  const { data: ethUsdPrice } = useQuery({
    queryKey: ["eth-usd-price"],
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<number | null> => {
      const prices = await fetchTokenPrices([WETH_ADDRESS])
      return prices[WETH_ADDRESS] ?? null
    },
  })

  if (!balance || balance.value === 0n) return null

  const parsed = Number(formatUnits(balance.value, 18))
  const usdPrice = ethUsdPrice ?? null
  const usdValue = usdPrice ? parsed * usdPrice : 0

  return {
    token: NATIVE_ETH_TOKEN,
    rawBalance: balance.value,
    balance: parsed,
    usdPrice,
    usdValue,
    sortKey: usdValue,
  }
}

/** Format a raw balance for display next to a token row. */
export function formatTokenBalance(raw: bigint | undefined, decimals: number): string {
  if (!raw || raw === 0n) return ""
  const formatted = formatUnits(raw, decimals)
  const num = Number(formatted)
  if (!Number.isFinite(num)) return ""
  if (num > 0 && num < 0.0001) return "<0.0001"
  if (num < 1) return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
  if (num < 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 3 })
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Format a USD value for the label under a balance.
 *
 * We distinguish three cases, which look identical on a spam row at a
 * glance but mean different things:
 *
 *   usdPrice === null       → "—"         No aggregator has a price for
 *                                          this contract. Common for
 *                                          airdrop spam and long-tail
 *                                          tokens. The dash means
 *                                          "we don't know what this is
 *                                          worth."
 *
 *   usdPrice > 0, value<$0.01 → "<$0.01"  A real price exists but the
 *                                          holding is dust. The user's
 *                                          position is genuinely worth
 *                                          less than a cent.
 *
 *   usdPrice > 0, value≥$0.01 → "$X.XX"   Normal formatted USD value.
 *
 * Callers that only have the precomputed value can pass usdPrice=null to
 * force the dash fallback.
 */
export function formatUsdValue(value: number, usdPrice: number | null): string {
  if (usdPrice == null) return "—"
  if (!value || value < 0.01) return "<$0.01"
  if (value < 1) return `$${value.toFixed(2)}`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}
