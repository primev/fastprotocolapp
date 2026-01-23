import { ZERO_ADDRESS } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { getTokenLists } from "@/lib/swap-logic/token-list"
import { isValidAddress } from "@/lib/utils"
import { Plus } from "lucide-react"

// Token Selector Modal
interface TokenSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectToken: (token: string) => void
  selectedToken: string | null
  excludeToken?: string | null
  customTokens: Record<string, Token>
  onAddCustomToken: (address: string, symbol: string) => void
}

export const DEFAULT_ETH_TOKEN: Token = {
  address: ZERO_ADDRESS,
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
  logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
}

export const TokenSelectorModal = ({
  open,
  onOpenChange,
  onSelectToken,
  selectedToken,
  excludeToken,
  customTokens,
  onAddCustomToken,
}: TokenSelectorModalProps) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customAddress, setCustomAddress] = useState("")
  const [customSymbol, setCustomSymbol] = useState("")

  const { popularTokens, allTokens } = getTokenLists(excludeToken)

  const filteredTokens = searchQuery
    ? allTokens.filter(
        (token) =>
          token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.address?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allTokens

  const handleAddCustomToken = () => {
    if (customAddress && customSymbol) {
      onAddCustomToken(customAddress, customSymbol.toUpperCase())
      onSelectToken(customSymbol.toUpperCase())
      setCustomAddress("")
      setCustomSymbol("")
      setShowCustomInput(false)
      onOpenChange(false)
    }
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
        {!searchQuery && (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground mb-2">Popular tokens</p>
            <div className="flex flex-wrap gap-2">
              {popularTokens.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => {
                    onSelectToken(token.symbol)
                    onOpenChange(false)
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors",
                    selectedToken === token.symbol
                      ? "bg-primary/20 border-primary/50"
                      : "bg-muted/30 border-border/50 hover:bg-muted/50"
                  )}
                >
                  <div className="h-5 w-5">
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = "none"
                        const parent = target.parentElement
                        if (parent) {
                          parent.innerHTML = `
                              <svg class="h-full w-full" viewBox="0 0 32 32" fill="none">
                                <circle cx="16" cy="16" r="16" fill="#6B7280" />
                                <text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">
                                  ${token.symbol.charAt(0)}
                                </text>
                              </svg>
                            `
                        }
                      }}
                    />
                  </div>
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
                onClick={() => {
                  onSelectToken(token.symbol)
                  onOpenChange(false)
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
                  selectedToken === token.symbol ? "bg-primary/10" : "hover:bg-muted/30"
                )}
              >
                <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center p-1.5">
                  <img
                    src={token.logoURI}
                    alt={token.symbol}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = "none"
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `
                            <svg class="h-full w-full" viewBox="0 0 32 32" fill="none">
                              <circle cx="16" cy="16" r="16" fill="#6B7280" />
                              <text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">
                                ${token.symbol.charAt(0)}
                              </text>
                            </svg>
                          `
                      }
                    }}
                  />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{token.symbol}</p>
                  <p className="text-xs text-muted-foreground">{token.name}</p>
                </div>
              </button>
            ))
          ) : searchQuery && isValidAddress(searchQuery) ? (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Token not found. Add it as a custom token?
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setCustomAddress(searchQuery)
                  setShowCustomInput(true)
                  setSearchQuery("")
                }}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Custom Token
              </Button>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">No tokens found</div>
          )}
        </div>

        {/* Custom Token Input */}
        <div className="border-t border-border/50">
          <button
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Add custom token</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                showCustomInput && "rotate-180"
              )}
            />
          </button>

          {showCustomInput && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Token Address</label>
                <Input
                  placeholder="0x..."
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  className="bg-muted/30 border-border/50 font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Token Symbol</label>
                <Input
                  placeholder="e.g. TOKEN"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  className="bg-muted/30 border-border/50"
                  maxLength={10}
                />
              </div>
              <Button
                onClick={handleAddCustomToken}
                disabled={!isValidAddress(customAddress) || !customSymbol}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Import Token
              </Button>
              {customAddress && !isValidAddress(customAddress) && (
                <p className="text-xs text-red-500">Please enter a valid Ethereum address</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
