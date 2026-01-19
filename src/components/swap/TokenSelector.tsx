"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Token } from "@/types/swap"

interface TokenSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokens: Token[]
  selectedToken?: Token
  onSelect: (token: Token) => void
}

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

  const handleSelect = (token: Token) => {
    onSelect(token)
    onOpenChange(false)
    setSearchQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search by name, symbol, or address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {filteredTokens.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No tokens found</div>
              ) : (
                filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleSelect(token)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors ${
                      selectedToken?.address === token.address ? "bg-muted" : ""
                    }`}
                  >
                    {token.logoURI && (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{token.symbol}</div>
                      {token.name && (
                        <div className="text-sm text-muted-foreground">{token.name}</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
