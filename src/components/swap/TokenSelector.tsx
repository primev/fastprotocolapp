"use client"

import React, { useState, useRef, useEffect } from "react"
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  // Reset scroll position when dialog opens
  useEffect(() => {
    if (open && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-[420px] w-[calc(100vw-24px)] p-0 gap-0 max-h-[85vh] overflow-hidden",
          "!flex !flex-col bg-[#131313] border border-white/10 shadow-2xl rounded-2xl",
          "[&>button]:text-white/60 [&>button]:hover:text-white [&>button]:right-4 [&>button]:top-4"
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        {/* HEADER AREA: Fixed size */}
        <div className="flex-shrink-0">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="text-xl font-semibold text-white">Select a token</DialogTitle>
          </DialogHeader>

          <div className="px-4 pt-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              <Input
                placeholder="Search name or paste address"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "h-12 pl-10 pr-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40",
                  "focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0 focus-visible:border-white/20",
                  "transition-colors duration-150"
                )}
              />
            </div>
          </div>

          {!searchQuery && popularTokens.length > 0 && (
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {popularTokens.map((token) => {
                  const isSelected = selectedToken?.address === token.address
                  return (
                    <button
                      key={token.address}
                      onClick={() => handleSelect(token)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-150",
                        isSelected
                          ? "bg-white/10 border-white/20 text-white"
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
          <div className="h-px bg-white/10 mx-4" />
        </div>

        {/* SCROLLABLE AREA: Improved scrolling with proper CSS */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto py-2 px-2 scrollbar-hide"
          style={
            {
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              scrollBehavior: "smooth",
              scrollbarWidth: "none", // Firefox
              msOverflowStyle: "none", // IE/Edge
            } as React.CSSProperties
          }
          onWheel={(e) => {
            // Ensure wheel events work for scrolling
            e.stopPropagation()
          }}
          onTouchMove={(e) => {
            // Allow touch scrolling
            e.stopPropagation()
          }}
        >
          {filteredTokens.length > 0 ? (
            <div className="flex flex-col">
              {filteredTokens.map((token) => {
                const isSelected = selectedToken?.address === token.address
                return (
                  <button
                    key={token.address}
                    onClick={() => handleSelect(token)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors duration-150 text-left",
                      isSelected ? "bg-white/10" : "hover:bg-white/5 active:bg-white/10"
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
                      <p className="font-medium text-white text-base truncate">{token.symbol}</p>
                      {token.name && (
                        <p className="text-sm text-white/60 truncate mt-0.5">{token.name}</p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    )}
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
