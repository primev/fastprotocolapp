"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Token } from "@/types/swap"

interface TokenSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokens: Token[]
  selectedToken?: Token
  onSelect: (token: Token) => void
}

// Popular tokens (ETH, USDC, USDT, DAI, WBTC)
const POPULAR_TOKEN_SYMBOLS = ["ETH", "USDC", "USDT", "DAI", "WBTC"]

export default function TokenSelector({
  open,
  onOpenChange,
  tokens,
  selectedToken,
  onSelect,
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const popularTokens = tokens.filter((token) =>
    POPULAR_TOKEN_SYMBOLS.includes(token.symbol.toUpperCase())
  )

  const handleSelect = (token: Token) => {
    onSelect(token)
    onOpenChange(false)
    setSearchQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-card border-border/50 max-h-[85vh] overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-lg font-semibold">Select a token</DialogTitle>
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

        {/* Popular Tokens */}
        {!searchQuery && popularTokens.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground mb-2">Popular tokens</p>
            <div className="flex flex-wrap gap-2">
              {popularTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleSelect(token)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors",
                    selectedToken?.address === token.address
                      ? "bg-primary/20 border-primary/50"
                      : "bg-muted/30 border-border/50 hover:bg-muted/50"
                  )}
                >
                  {token.logoURI && (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="h-5 w-5 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium">{token.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Token List */}
        <div className="overflow-y-auto max-h-[300px] p-2">
          {filteredTokens.length > 0 ? (
            filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => handleSelect(token)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
                  selectedToken?.address === token.address
                    ? "bg-primary/10"
                    : "hover:bg-muted/30"
                )}
              >
                <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center p-1.5">
                  {token.logoURI ? (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-full h-full rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-primary/20" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{token.symbol}</p>
                  {token.name && (
                    <p className="text-xs text-muted-foreground">{token.name}</p>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No tokens found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
