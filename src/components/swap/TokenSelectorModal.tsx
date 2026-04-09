"use client"

import React, { useState, useMemo, useEffect } from "react"
import { ZERO_ADDRESS } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Coins, Sparkles, Clock } from "lucide-react"
import { useRecentTokens } from "@/hooks/use-recent-tokens"
import { cn } from "@/lib/utils"
import { getTokenLists } from "@/lib/swap-logic/token-list"
import { isValidAddress } from "@/lib/utils"
import { useAccount, useChainId } from "wagmi"
import {
  useHeldTokens,
  useNativeEthHeld,
  formatTokenBalance,
  formatUsdValue,
  type HeldToken,
} from "@/hooks/use-token-balances"
import {
  loadBarterSupportedTokens,
  getBarterMap,
  barterEntryToToken,
} from "@/lib/barter-supported-tokens"
import { TokenAvatar } from "@/components/swap/TokenAvatar"

// Token Selector Modal
interface TokenSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectToken: (token: Token) => void
  selectedToken?: string | null
  excludeToken?: string | null
}

interface TokenRowProps {
  token: Token
  balanceLabel: string
  usdLabel: string
  selected: boolean
  onSelect: () => void
}

interface SectionHeaderProps {
  icon: React.ReactNode
  label: string
  count: number
  action?: React.ReactNode
}

const SectionHeader = ({ icon, label, count, action }: SectionHeaderProps) => (
  <div className="sticky top-0 z-20 -mx-2 flex items-center gap-2 px-5 pt-4 pb-2 bg-card">
    <span className="flex h-5 w-5 items-center justify-center text-muted-foreground">{icon}</span>
    <span className="text-sm font-semibold text-foreground/90">{label}</span>
    <span className="text-xs font-medium text-muted-foreground tabular-nums">{count}</span>
    {action ? <div className="ml-auto">{action}</div> : null}
  </div>
)

/** Truncate an Ethereum address like Uniswap does: 0xA0b8…eB48 */
function shortAddress(address: string): string {
  if (!address || address.length < 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

const TokenRow = React.memo(function TokenRow({
  token,
  balanceLabel,
  usdLabel,
  selected,
  onSelect,
}: TokenRowProps) {
  const isHeld = Boolean(balanceLabel)
  // Held rows mirror Uniswap's layout: name primary, "SYMBOL 0xAbCd…1234"
  // secondary on the left; USD primary, token amount secondary on the right.
  // Non-held rows keep the simpler name + symbol pair with no right column.
  const primaryName = token.name || token.symbol
  const isNativeEth = !token.address || token.address.toLowerCase() === ZERO_ADDRESS.toLowerCase()
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
        selected ? "bg-primary/10" : "hover:bg-muted/30"
      )}
    >
      <TokenAvatar token={token} size={36} className="bg-muted/50" />
      <div className="flex-1 text-left min-w-0">
        <p className="font-medium truncate">{primaryName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {isHeld && !isNativeEth ? (
            <>
              <span>{token.symbol}</span>
              <span className="ml-2 font-mono">{shortAddress(token.address)}</span>
            </>
          ) : (
            token.symbol
          )}
        </p>
      </div>
      {isHeld ? (
        <div className="text-right pl-2">
          <p className="text-sm font-medium tabular-nums text-foreground/90">
            {usdLabel || balanceLabel}
          </p>
          {usdLabel ? (
            <p className="text-xs text-muted-foreground tabular-nums">{balanceLabel}</p>
          ) : null}
        </div>
      ) : null}
    </button>
  )
})

export const DEFAULT_ETH_TOKEN: Token = {
  address: ZERO_ADDRESS,
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
  logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
}

const SEARCH_DEBOUNCE_MS = 150
const BARTER_SEARCH_CAP = 50

const TokenSelectorModalComponent = ({
  open,
  onOpenChange,
  onSelectToken,
  selectedToken,
  excludeToken,
}: TokenSelectorModalProps) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [barterMapReady, setBarterMapReady] = useState<boolean>(() => getBarterMap() !== null)

  const { suggestedChips, popularTokens, allTokens } = getTokenLists(excludeToken)
  const excludeAddrLower = useMemo(() => {
    if (!excludeToken) return null
    const t = allTokens.find((x) => x.symbol === excludeToken)
    return t?.address.toLowerCase() ?? null
  }, [excludeToken, allTokens])

  const { address } = useAccount()
  const chainId = useChainId()
  const {
    data: heldErc20s,
    isLoading: isLoadingHeld,
    isError: heldError,
    refetch: refetchHeld,
  } = useHeldTokens(address, chainId)
  const nativeEth = useNativeEthHeld(address, chainId)
  const { recent, addRecent, clearRecent } = useRecentTokens(chainId)

  // Merge native ETH into the held-tokens list. ETH is fetched via wagmi's
  // useBalance (works even without an Alchemy key) and kept here rather than
  // inside useHeldTokens so it's independent of the ERC-20 discovery query.
  const heldTokens = useMemo<HeldToken[]>(() => {
    const list = heldErc20s ?? []
    if (!nativeEth) return list
    // Re-sort after inserting ETH so its USD value lands in the right slot.
    const merged = [...list, nativeEth]
    merged.sort((a, b) => {
      if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey
      if ((a.usdPrice != null) !== (b.usdPrice != null)) {
        return a.usdPrice != null ? -1 : 1
      }
      return b.balance - a.balance
    })
    return merged
  }, [heldErc20s, nativeEth])

  // Prefetch the barter map as soon as the modal opens so search can hit it
  // without a cold-start wait. Flip a ready flag when it resolves so memos
  // that depend on getBarterMap() recompute.
  useEffect(() => {
    if (!open || barterMapReady) return
    loadBarterSupportedTokens()
      .then(() => setBarterMapReady(true))
      .catch(() => {})
  }, [open, barterMapReady])

  // Debounce the search query so barter-map scanning only runs after typing settles.
  useEffect(() => {
    const tid = setTimeout(
      () => setDebouncedQuery(searchQuery.trim().toLowerCase()),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(tid)
  }, [searchQuery])

  // Clear transient state when the modal closes.
  useEffect(() => {
    if (!open) {
      setSearchQuery("")
      setDebouncedQuery("")
    }
  }, [open])

  // Default view: short curated blue-chip list minus anything in Your tokens.
  const defaultPopular = useMemo(() => {
    const held = heldTokens ?? []
    if (held.length === 0) return popularTokens
    const heldSet = new Set(held.map((h) => h.token.address.toLowerCase()))
    return popularTokens.filter((t) => !heldSet.has(t.address.toLowerCase()))
  }, [popularTokens, heldTokens])

  // Search view: full 344-entry curated list minus held, still filtered below.
  const searchCurated = useMemo(() => {
    const held = heldTokens ?? []
    if (held.length === 0) return allTokens
    const heldSet = new Set(held.map((h) => h.token.address.toLowerCase()))
    return allTokens.filter((t) => !heldSet.has(t.address.toLowerCase()))
  }, [allTokens, heldTokens])

  const q = debouncedQuery
  const matchesQuery = (t: { symbol: string; name?: string; address: string }) =>
    !q ||
    t.symbol.toLowerCase().includes(q) ||
    (t.name?.toLowerCase().includes(q) ?? false) ||
    t.address.toLowerCase().includes(q)

  const filteredHeld: HeldToken[] = useMemo(
    () =>
      (heldTokens ?? []).filter(
        (h) => matchesQuery(h.token) && h.token.address.toLowerCase() !== excludeAddrLower
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heldTokens, q, excludeAddrLower]
  )

  const filteredCurated = useMemo(
    () => searchCurated.filter(matchesQuery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchCurated, q]
  )

  // Extended search: scan the barter map for matches not already surfaced above.
  // Only runs when the user has typed something; cached map so this is cheap.
  const barterMatches: Token[] = useMemo(() => {
    if (!q) return []
    const map = getBarterMap()
    if (!map) return []
    const already = new Set<string>()
    for (const h of filteredHeld) already.add(h.token.address.toLowerCase())
    for (const t of filteredCurated) already.add(t.address.toLowerCase())
    if (excludeAddrLower) already.add(excludeAddrLower)

    const results: Token[] = []
    const isAddressQuery = q.startsWith("0x")

    // Address lookups are exact — hit the map directly.
    if (isAddressQuery) {
      const entry = map.get(q)
      if (entry && !already.has(q)) {
        const t = barterEntryToToken(entry)
        if (t) results.push(t)
      }
      return results
    }

    // Symbol / name scan. Cap results aggressively so this stays O(cap * n).
    for (const entry of map.values()) {
      if (results.length >= BARTER_SEARCH_CAP) break
      if (already.has(entry.address)) continue
      const sym = entry.tokenInfo.symbol.toLowerCase()
      const name = entry.tokenInfo.name.toLowerCase()
      if (sym.includes(q) || name.includes(q)) {
        const t = barterEntryToToken(entry)
        if (t) results.push(t)
      }
    }
    // Rank: exact symbol match first, then symbol startsWith, then the rest.
    results.sort((a, b) => {
      const as = a.symbol.toLowerCase()
      const bs = b.symbol.toLowerCase()
      const aExact = as === q ? 0 : as.startsWith(q) ? 1 : 2
      const bExact = bs === q ? 0 : bs.startsWith(q) ? 1 : 2
      if (aExact !== bExact) return aExact - bExact
      return as.localeCompare(bs)
    })
    return results
    // barterMapReady is included so this memo re-runs when the map finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filteredHeld, filteredCurated, excludeAddrLower, barterMapReady])

  // Paste-address auto-populate: if the user pastes a valid address that's in
  // the barter map, offer it as a single row even before search scanning kicks in.
  const pastedBarterToken: Token | null = useMemo(() => {
    if (!q || !isValidAddress(q)) return null
    const map = getBarterMap()
    const entry = map?.get(q)
    if (!entry) return null
    return barterEntryToToken(entry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, barterMapReady])

  // Recent tokens — filtered only against the current excludeToken (the
  // other side of the swap). We intentionally do NOT dedup against Your
  // tokens: Uniswap shows Recent searches as a distinct section even if
  // the user also holds those tokens, and suppressing them here made the
  // section disappear any time the user searched for something they
  // already held.
  const filteredRecent = useMemo(() => {
    return recent.filter((t) => t.address.toLowerCase() !== excludeAddrLower)
  }, [recent, excludeAddrLower])

  const handleSelect = (token: Token) => {
    addRecent(token)
    onSelectToken(token)
    onOpenChange(false)
  }

  const hasAnyResults = searchQuery
    ? filteredHeld.length > 0 ||
      filteredCurated.length > 0 ||
      barterMatches.length > 0 ||
      pastedBarterToken !== null
    : filteredHeld.length > 0 || filteredRecent.length > 0 || defaultPopular.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-card border-border/50 max-h-[85vh] overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-lg font-semibold">Select a token</DialogTitle>
          <DialogDescription className="sr-only">Token selection menu</DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="p-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or paste address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30 border-border/50"
            />
          </div>
        </div>

        {/* Suggested Tokens (chip cards) — mirrors Uniswap's vertical layout */}
        {!searchQuery && suggestedChips.length > 0 && (
          <div className="px-4 pb-3">
            <div className="grid grid-cols-5 gap-2">
              {suggestedChips.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => handleSelect(token)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-colors",
                    selectedToken === token.symbol
                      ? "bg-primary/20 border-primary/50"
                      : "bg-muted/30 border-border/50 hover:bg-muted/50"
                  )}
                >
                  <TokenAvatar token={token} size={32} />
                  <span className="text-sm font-medium leading-none">{token.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Token List */}
        <div className="overflow-y-auto max-h-[420px] px-2 pb-2">
          {heldError && address && (
            <div className="mx-2 mb-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center justify-between">
              <span>Couldn&apos;t load your balances.</span>
              <button
                onClick={() => refetchHeld()}
                className="font-medium text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          {hasAnyResults ? (
            searchQuery ? (
              // Unified "Search results" list — matches Uniswap's search UX.
              <section>
                <SectionHeader
                  icon={<Search className="h-4 w-4" />}
                  label="Search results"
                  count={
                    (pastedBarterToken ? 1 : 0) +
                    filteredHeld.length +
                    filteredCurated.length +
                    barterMatches.length
                  }
                />
                {pastedBarterToken && (
                  <TokenRow
                    key={`paste-${pastedBarterToken.address}`}
                    token={pastedBarterToken}
                    balanceLabel=""
                    usdLabel=""
                    selected={selectedToken === pastedBarterToken.symbol}
                    onSelect={() => handleSelect(pastedBarterToken)}
                  />
                )}
                {filteredHeld.map((h) => (
                  <TokenRow
                    key={`held-${h.token.address}`}
                    token={h.token}
                    balanceLabel={formatTokenBalance(h.rawBalance, h.token.decimals)}
                    usdLabel={formatUsdValue(h.usdValue)}
                    selected={selectedToken === h.token.symbol}
                    onSelect={() => handleSelect(h.token)}
                  />
                ))}
                {filteredCurated.map((token) => (
                  <TokenRow
                    key={token.address}
                    token={token}
                    balanceLabel=""
                    usdLabel=""
                    selected={selectedToken === token.symbol}
                    onSelect={() => handleSelect(token)}
                  />
                ))}
                {barterMatches.map((token) => (
                  <TokenRow
                    key={`barter-${token.address}`}
                    token={token}
                    balanceLabel=""
                    usdLabel=""
                    selected={selectedToken === token.symbol}
                    onSelect={() => handleSelect(token)}
                  />
                ))}
              </section>
            ) : (
              // Default view: Your tokens + Recent searches + Popular tokens.
              <>
                {filteredHeld.length > 0 && (
                  <section>
                    <SectionHeader
                      icon={<Coins className="h-4 w-4" />}
                      label="Your tokens"
                      count={filteredHeld.length}
                    />
                    {filteredHeld.map((h) => (
                      <TokenRow
                        key={`held-${h.token.address}`}
                        token={h.token}
                        balanceLabel={formatTokenBalance(h.rawBalance, h.token.decimals)}
                        usdLabel={formatUsdValue(h.usdValue)}
                        selected={selectedToken === h.token.symbol}
                        onSelect={() => handleSelect(h.token)}
                      />
                    ))}
                  </section>
                )}
                {filteredRecent.length > 0 && (
                  <section>
                    <SectionHeader
                      icon={<Clock className="h-4 w-4" />}
                      label="Recent searches"
                      count={filteredRecent.length}
                      action={
                        <button
                          onClick={clearRecent}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Clear
                        </button>
                      }
                    />
                    {filteredRecent.map((token) => (
                      <TokenRow
                        key={`recent-${token.address}`}
                        token={token}
                        balanceLabel=""
                        usdLabel=""
                        selected={selectedToken === token.symbol}
                        onSelect={() => handleSelect(token)}
                      />
                    ))}
                  </section>
                )}
                {defaultPopular.length > 0 && (
                  <section>
                    <SectionHeader
                      icon={<Sparkles className="h-4 w-4" />}
                      label="Popular tokens"
                      count={defaultPopular.length}
                    />
                    {defaultPopular.map((token) => (
                      <TokenRow
                        key={token.address}
                        token={token}
                        balanceLabel=""
                        usdLabel=""
                        selected={selectedToken === token.symbol}
                        onSelect={() => handleSelect(token)}
                      />
                    ))}
                  </section>
                )}
                {isLoadingHeld && filteredHeld.length === 0 && address && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Loading your balances…</p>
                )}
              </>
            )
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {searchQuery ? "No tokens found" : "No tokens"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const TokenSelectorModal = React.memo(TokenSelectorModalComponent)
