"use client"

import React, { useState } from "react"
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

const POPULAR_TOKEN_SYMBOLS = ["ETH", "USDC", "USDT", "DAI", "WBTC"]

function TokenSelector({
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
      <DialogContent
        className={cn(
          "sm:max-w-[420px] w-[calc(100vw-24px)] p-0 gap-0 max-h-[85vh] overflow-hidden",
          "!flex !flex-col bg-[#131313] border border-white/10 shadow-2xl rounded-[24px]",
          "[&>button]:text-white/60 [&>button]:hover:text-white [&>button]:right-5 [&>button]:top-5"
        )}
        // This is a Radix fix: prevents the focus trap from disabling scroll interaction
        onOpenAutoFocus={(e) => {
          if (filteredTokens.length > 0) e.preventDefault()
        }}
      >
        {/* HEADER AREA: Fixed size */}
        <div className="flex-shrink-0">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-lg font-semibold text-white">Select a token</DialogTitle>
          </DialogHeader>

          <div className="px-5 pt-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              <Input
                placeholder="Search by name or paste address"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "h-11 pl-10 pr-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40",
                  "focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent focus-visible:border-white/20",
                  "transition-colors duration-200"
                )}
              />
            </div>
          </div>

          {!searchQuery && popularTokens.length > 0 && (
            <div className="px-5 pt-4 pb-3">
              <p className="text-xs text-white/50 mb-2.5 font-medium uppercase tracking-wider">
                Popular tokens
              </p>
              <div className="flex flex-wrap gap-2">
                {popularTokens.map((token) => {
                  const isSelected = selectedToken?.address === token.address
                  return (
                    <button
                      key={token.address}
                      onClick={() => handleSelect(token)}
                      className={cn(
                        "flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all duration-200",
                        isSelected
                          ? "bg-primary/20 border-primary/50 text-white"
                          : "bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:border-white/15"
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
                  )
                })}
              </div>
            </div>
          )}
          <div className="h-px bg-white/10 mx-5 mt-1" />
        </div>

        {/* SCROLLABLE AREA: Uses flex-1 min-h-0 overflow-y-auto pattern */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2 px-3">
          {filteredTokens.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {filteredTokens.map((token) => {
                const isSelected = selectedToken?.address === token.address
                return (
                  <button
                    key={token.address}
                    onClick={() => handleSelect(token)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left",
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {token.logoURI ? (
                        <img
                          src={token.logoURI}
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-primary/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{token.symbol}</p>
                      {token.name && <p className="text-xs text-white/50 truncate">{token.name}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-white/50 text-sm">No tokens found</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default React.memo(TokenSelector)
