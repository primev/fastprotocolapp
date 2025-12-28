"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowDown, ChevronDown, Loader2, Settings, Info, Search, X, Plus } from "lucide-react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SwapReviewModal } from "./SwapReviewModal"

// Token Icons
const ETH_ICON = (
  <svg className="h-full w-full fill-current" viewBox="0 0 320 512">
    <path d="M311.9 260.8L160 353.6 8 260.8 160 0l151.9 260.8zM160 383.4L8 290.6 160 512l152-221.4-152 92.8z" />
  </svg>
)

const FAST_ICON = (
  <svg className="h-full w-full" viewBox="0 0 98 95" fill="none">
    <path
      d="M0.344727 0.226562L36.7147 94.6165H59.9647L26.0747 0.226562H0.344727Z"
      className="fill-primary"
    />
    <path
      d="M72.8246 0.226562L52.5447 56.5766H76.2947L97.8146 0.226562H72.8246Z"
      fill="#E97D25"
    />
  </svg>
)

const USDC_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#2775CA" />
    <path
      d="M20.5 18.5c0-2-1.5-2.75-4.5-3.25-2-.5-2.5-1-2.5-2s1-1.75 2.5-1.75c1.5 0 2.25.5 2.5 1.5h2c-.25-1.75-1.5-3-3.5-3.25V8h-2v1.75c-2 .25-3.5 1.5-3.5 3.5 0 2 1.5 2.75 4.5 3.25 2 .5 2.5 1 2.5 2s-1 1.75-2.5 1.75c-1.75 0-2.5-.75-2.75-1.75h-2c.25 2 1.75 3.25 3.75 3.5V24h2v-1.75c2-.25 3.5-1.5 3.5-3.75z"
      fill="white"
    />
  </svg>
)

const USDT_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117" fill="white"/>
  </svg>
)

const WBTC_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#F7931A" />
    <path d="M22.5 14.7c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.6c-.4-.1-.8-.2-1.3-.3l.7-2.7-1.6-.4-.7 2.7c-.3-.1-.7-.2-1-.2l-2.2-.5-.4 1.7s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2c0 0 .1 0 .2.1h-.2l-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.8 2.1.5c.4.1.8.2 1.2.3l-.7 2.8 1.6.4.7-2.7c.4.1.9.2 1.3.3l-.7 2.7 1.6.4.7-2.8c2.9.5 5.1.3 6-2.3.7-2.1 0-3.3-1.6-4.1 1.1-.3 2-1.1 2.2-2.8zm-4 5.5c-.5 2.1-4.1 1-5.3.7l.9-3.8c1.2.3 4.9.9 4.4 3.1zm.5-5.6c-.5 1.9-3.5.9-4.4.7l.8-3.4c1 .2 4.1.7 3.6 2.7z" fill="white"/>
  </svg>
)

const DAI_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#F5AC37" />
    <path d="M16 6l-8 10 8 10 8-10-8-10z" fill="white"/>
  </svg>
)

const LINK_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#2A5ADA" />
    <path d="M16 6l-2 1.2-6 3.4-2 1.2v8.4l2 1.2 6 3.4 2 1.2 2-1.2 6-3.4 2-1.2v-8.4l-2-1.2-6-3.4-2-1.2zm0 2.4l6 3.4v6.8l-6 3.4-6-3.4v-6.8l6-3.4z" fill="white"/>
  </svg>
)

const UNI_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#FF007A" />
    <path d="M12 10c1.5 0 2.5 1 3 2 .5-1 1.5-2 3-2s2.5 1 3 2v8c-.5 1-1.5 2-3 2s-2.5-1-3-2c-.5 1-1.5 2-3 2s-2.5-1-3-2v-8c.5-1 1.5-2 3-2z" fill="white"/>
  </svg>
)

const AAVE_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#B6509E" />
    <path d="M16 8l-6 14h3l1-3h4l1 3h3l-6-14zm0 4l1.5 5h-3l1.5-5z" fill="white"/>
  </svg>
)

const ARB_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#28A0F0" />
    <path d="M16 6l8 10-8 10-8-10 8-10z" fill="white"/>
  </svg>
)

const OP_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#FF0420" />
    <path d="M10 12h4c2 0 3 1 3 3s-1 3-3 3h-2v4h-2v-10zm2 4h2c.5 0 1-.5 1-1s-.5-1-1-1h-2v2zm8-4h2v10h-2v-10z" fill="white"/>
  </svg>
)

const MATIC_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#8247E5" />
    <path d="M20 12l-4-2-4 2v8l4 2 4-2v-8zm-4 7l-2-1v-4l2-1 2 1v4l-2 1z" fill="white"/>
  </svg>
)

const WETH_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#EC4899" />
    <path d="M16 6l-6 10 6 4 6-4-6-10zm0 16l-6-4 6 8 6-8-6 4z" fill="white"/>
  </svg>
)

type TokenKey = "ETH" | "FAST" | "USDC" | "USDT" | "WBTC" | "DAI" | "LINK" | "UNI" | "AAVE" | "ARB" | "OP" | "MATIC" | "WETH"
type TokenType = TokenKey | string | null

interface Token {
  symbol: string
  name: string
  icon: React.ReactNode
  balance: string
  address?: string
  popular?: boolean
}

const TOKENS: Record<string, Token> = {
  ETH: { symbol: "ETH", name: "Ethereum", icon: ETH_ICON, balance: "0.00", popular: true },
  FAST: { symbol: "FAST", name: "Fast Token", icon: FAST_ICON, balance: "0.00", popular: true },
  USDC: { symbol: "USDC", name: "USD Coin", icon: USDC_ICON, balance: "0.00", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", popular: true },
  USDT: { symbol: "USDT", name: "Tether USD", icon: USDT_ICON, balance: "0.00", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", popular: true },
  WBTC: { symbol: "WBTC", name: "Wrapped Bitcoin", icon: WBTC_ICON, balance: "0.00", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", popular: true },
  DAI: { symbol: "DAI", name: "Dai Stablecoin", icon: DAI_ICON, balance: "0.00", address: "0x6B175474E89094C44Da98b954EescdeCB5e", popular: true },
  LINK: { symbol: "LINK", name: "Chainlink", icon: LINK_ICON, balance: "0.00", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  UNI: { symbol: "UNI", name: "Uniswap", icon: UNI_ICON, balance: "0.00", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" },
  AAVE: { symbol: "AAVE", name: "Aave Token", icon: AAVE_ICON, balance: "0.00", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" },
  ARB: { symbol: "ARB", name: "Arbitrum", icon: ARB_ICON, balance: "0.00", address: "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1" },
  OP: { symbol: "OP", name: "Optimism", icon: OP_ICON, balance: "0.00", address: "0x4200000000000000000000000000000000000042" },
  MATIC: { symbol: "MATIC", name: "Polygon", icon: MATIC_ICON, balance: "0.00", address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0" },
  WETH: { symbol: "WETH", name: "Wrapped Ether", icon: WETH_ICON, balance: "0.00", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
}

// Default icon for custom tokens
const DEFAULT_TOKEN_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#6B7280" />
    <text x="16" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">?</text>
  </svg>
)

interface TokenButtonProps {
  token: TokenType
  onClick: () => void
  showBalance?: boolean
  customTokens?: Record<string, Token>
}

function TokenButton({ token, onClick, showBalance, customTokens = {} }: TokenButtonProps) {
  if (!token) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-full bg-pink-500 hover:bg-pink-600 px-3 sm:px-4 py-1.5 sm:py-2 text-white font-semibold text-sm sm:text-base transition-colors active:scale-95"
      >
        Select token
        <ChevronDown className="h-4 w-4" />
      </button>
    )
  }

  const allTokens = { ...TOKENS, ...customTokens }
  const tokenData = allTokens[token] || { symbol: token, name: "Custom Token", icon: DEFAULT_TOKEN_ICON, balance: "0.00" }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 px-2.5 sm:px-3 py-1.5 sm:py-2 font-semibold text-sm sm:text-base transition-colors active:scale-95"
      >
        <div className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center">
          {tokenData.icon}
        </div>
        {tokenData.symbol}
        <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
      </button>
      {showBalance && (
        <span className="text-[10px] sm:text-xs text-muted-foreground pr-1">
          Balance: {tokenData.balance}
        </span>
      )}
    </div>
  )
}

// Token Selector Modal
interface TokenSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectToken: (token: string) => void
  selectedToken: TokenType
  excludeToken?: TokenType
  customTokens: Record<string, Token>
  onAddCustomToken: (address: string, symbol: string) => void
}

function TokenSelectorModal({
  open,
  onOpenChange,
  onSelectToken,
  selectedToken,
  excludeToken,
  customTokens,
  onAddCustomToken,
}: TokenSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customAddress, setCustomAddress] = useState("")
  const [customSymbol, setCustomSymbol] = useState("")

  const allTokens = { ...TOKENS, ...customTokens }
  const popularTokens = Object.entries(TOKENS).filter(([key, token]) => token.popular && key !== excludeToken)
  const allTokenList = Object.entries(allTokens).filter(([key]) => key !== excludeToken)

  const filteredTokens = searchQuery
    ? allTokenList.filter(
        ([key, token]) =>
          token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.address?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allTokenList

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

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr)

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
              {popularTokens.map(([key, token]) => (
                <button
                  key={key}
                  onClick={() => {
                    onSelectToken(key)
                    onOpenChange(false)
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors",
                    selectedToken === key
                      ? "bg-primary/20 border-primary/50"
                      : "bg-muted/30 border-border/50 hover:bg-muted/50"
                  )}
                >
                  <div className="h-5 w-5">{token.icon}</div>
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
            filteredTokens.map(([key, token]) => (
              <button
                key={key}
                onClick={() => {
                  onSelectToken(key)
                  onOpenChange(false)
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
                  selectedToken === key
                    ? "bg-primary/10"
                    : "hover:bg-muted/30"
                )}
              >
                <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center p-1.5">
                  {token.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{token.symbol}</p>
                  <p className="text-xs text-muted-foreground">{token.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{token.balance}</p>
                </div>
              </button>
            ))
          ) : searchQuery && isValidAddress(searchQuery) ? (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">Token not found. Add it as a custom token?</p>
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
            <div className="p-4 text-center text-muted-foreground text-sm">
              No tokens found
            </div>
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

// Animated Background Orbs
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Primary orb */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-primary/20 blur-3xl animate-pulse" />
      {/* Secondary orb */}
      <div className="absolute bottom-1/4 -right-20 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-pink-500/15 blur-3xl animate-pulse [animation-delay:1s]" />
      {/* Accent orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-72 sm:h-72 rounded-full bg-accent/10 blur-3xl animate-pulse [animation-delay:2s]" />
    </div>
  )
}

function truncateAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function SwapForm() {
  const { address, isConnected } = useAccount()
  const [sellAmount, setSellAmount] = useState("")
  const [buyAmount, setBuyAmount] = useState("")
  const [isSwapping, setIsSwapping] = useState(false)
  const [sellToken, setSellToken] = useState<TokenType>("ETH")
  const [buyToken, setBuyToken] = useState<TokenType>(null)
  const [slippage, setSlippage] = useState("0.5")
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showSellTokenSelector, setShowSellTokenSelector] = useState(false)
  const [showBuyTokenSelector, setShowBuyTokenSelector] = useState(false)
  const [customTokens, setCustomTokens] = useState<Record<string, Token>>({})
  const sellInputRef = useRef<HTMLInputElement>(null)

  // Mock exchange rate calculation
  const exchangeRate = sellToken === "ETH" && buyToken === "FAST" ? 1000 :
                       sellToken === "FAST" && buyToken === "ETH" ? 0.001 :
                       sellToken === "ETH" && buyToken === "USDC" ? 2300 :
                       sellToken === "USDC" && buyToken === "ETH" ? 0.000435 : 1

  // Update buy amount when sell amount changes
  useEffect(() => {
    if (sellAmount && sellToken && buyToken) {
      const calculated = (parseFloat(sellAmount) * exchangeRate).toFixed(6)
      setBuyAmount(calculated)
    } else {
      setBuyAmount("")
    }
  }, [sellAmount, sellToken, buyToken, exchangeRate])

  const handleSwapTokens = () => {
    const tempToken = sellToken
    const tempAmount = sellAmount
    setSellToken(buyToken)
    setBuyToken(tempToken)
    setSellAmount(buyAmount)
    setBuyAmount(tempAmount)
  }

  const handleSwapClick = () => {
    if (!sellAmount || !isConnected || !buyToken) return
    setShowReviewModal(true)
  }

  const handleConfirmSwap = async () => {
    if (!sellAmount || !isConnected || !buyToken) return
    setIsSwapping(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsSwapping(false)
    setShowReviewModal(false)
    setSellAmount("")
    setBuyAmount("")
  }

  const handleTokenSelect = (type: "sell" | "buy", token: string) => {
    if (type === "sell") {
      if (token === buyToken) setBuyToken(sellToken)
      setSellToken(token)
    } else {
      if (token === sellToken) setSellToken(buyToken)
      setBuyToken(token)
    }
  }

  const handleAddCustomToken = (address: string, symbol: string) => {
    setCustomTokens((prev) => ({
      ...prev,
      [symbol]: {
        symbol,
        name: `Custom Token (${symbol})`,
        icon: DEFAULT_TOKEN_ICON,
        balance: "0.00",
        address,
      },
    }))
  }

  const allTokens = { ...TOKENS, ...customTokens }

  const isSwapReady = sellAmount && sellToken && buyToken && isConnected
  const priceImpact = sellAmount ? "< 0.01%" : "-"

  return (
    <div className="relative min-h-[70vh] sm:min-h-[60vh] flex flex-col items-center justify-center px-4">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Hero Section */}
      <div className="relative z-10 text-center mb-4 sm:mb-6 max-w-2xl">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent leading-tight pb-1">
          Lightning-fast swaps
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground whitespace-nowrap">
          Trade crypto on Fast Protocol with fast execution and mev rewards
        </p>
      </div>

      {/* Swap Card */}
      <div className="relative z-10 w-full max-w-[520px] px-4 sm:px-0">
        <div className="rounded-[24px] bg-[#0d1117] border border-white/5 shadow-2xl p-6">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xl font-semibold text-white">Swap</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <Settings className="h-5 w-5 text-gray-400" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Slippage: {slippage}%</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Swap Body */}
          <div className="space-y-3">
            {/* Sell Section */}
            <div className="rounded-2xl bg-[#161b22] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Sell</span>
                {sellToken && allTokens[sellToken] && (
                  <span className="text-xs text-gray-500">
                    Balance: {allTokens[sellToken].balance}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Input
                    ref={sellInputRef}
                    type="number"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0"
                    className="border-0 bg-transparent p-0 text-[26px] font-medium text-white h-auto focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  {sellAmount && sellToken && (
                    <div className="mt-2 text-xs text-gray-500">
                      ≈ ${sellToken === "ETH" ? (parseFloat(sellAmount) * 2300).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (parseFloat(sellAmount) * 0.01).toFixed(2)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowSellTokenSelector(true)}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 rounded-[10px] px-3 py-2 font-semibold text-sm text-white transition-colors shrink-0"
                >
                  {sellToken && allTokens[sellToken] ? (
                    <>
                      <div className="h-5 w-5">{allTokens[sellToken].icon}</div>
                      {allTokens[sellToken].symbol}
                    </>
                  ) : (
                    "Select"
                  )}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Swap Arrow Button */}
            <div className="flex justify-center -my-5 relative z-10">
              <button
                onClick={handleSwapTokens}
                className="h-11 w-11 rounded-full bg-[#0d1117] border-4 border-[#161b22] flex items-center justify-center hover:bg-[#1c2128] transition-all active:scale-90 group"
              >
                <ArrowDown className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors group-hover:rotate-180 duration-300" />
              </button>
            </div>

            {/* Buy Section */}
            <div className="rounded-2xl bg-[#161b22] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Buy</span>
                {buyToken && allTokens[buyToken] && (
                  <span className="text-xs text-gray-500">
                    Balance: {allTokens[buyToken].balance}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Input
                    type="text"
                    value={buyAmount}
                    readOnly
                    placeholder="0"
                    className="border-0 bg-transparent p-0 text-[26px] font-medium text-gray-400 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  {buyAmount && buyToken && (
                    <div className="mt-2 text-xs text-gray-500">
                      ≈ ${buyToken === "ETH" ? (parseFloat(buyAmount) * 2300).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (parseFloat(buyAmount) * 0.01).toFixed(2)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowBuyTokenSelector(true)}
                  className={cn(
                    "flex items-center gap-2 rounded-[10px] px-3 py-2 font-semibold text-sm transition-colors shrink-0",
                    buyToken
                      ? "bg-primary hover:bg-primary/90 text-white"
                      : "bg-pink-500 hover:bg-pink-600 text-white"
                  )}
                >
                  {buyToken && allTokens[buyToken] ? (
                    <>
                      <div className="h-5 w-5">{allTokens[buyToken].icon}</div>
                      {allTokens[buyToken].symbol}
                    </>
                  ) : (
                    "Select token"
                  )}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Exchange Rate Info */}
          {sellToken && buyToken && (
            <div className="mt-3 rounded-xl bg-white/5 px-4 py-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>1 {sellToken} = {exchangeRate.toLocaleString()} {buyToken}</span>
                <span>Price Impact: {priceImpact}</span>
              </div>
            </div>
          )}

          {/* CTA Button */}
          <div className="mt-4">
            {!isConnected ? (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <Button
                    onClick={openConnectModal}
                    className="w-full h-[54px] rounded-2xl font-bold text-lg bg-gradient-to-r from-pink-500 to-primary hover:opacity-90 transition-all active:scale-[0.98]"
                  >
                    Connect Wallet
                  </Button>
                )}
              </ConnectButton.Custom>
            ) : !buyToken ? (
              <Button
                disabled
                className="w-full h-[54px] rounded-2xl font-bold text-lg bg-white/10 text-gray-500 cursor-not-allowed"
              >
                Select a token
              </Button>
            ) : !sellAmount ? (
              <Button
                disabled
                className="w-full h-[54px] rounded-2xl font-bold text-lg bg-white/10 text-gray-500 cursor-not-allowed"
              >
                Enter an amount
              </Button>
            ) : (
              <Button
                onClick={handleSwapClick}
                className="w-full h-[54px] rounded-2xl font-bold text-lg bg-gradient-to-r from-pink-500 to-primary hover:opacity-90 transition-all active:scale-[0.98]"
              >
                Swap
              </Button>
            )}
          </div>
        </div>

        {/* Network Badge */}
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Fast Protocol Network
          </div>
        </div>
      </div>

      {/* Swap Review Modal */}
      {sellToken && buyToken && (
        <SwapReviewModal
          open={showReviewModal}
          onOpenChange={setShowReviewModal}
          fromToken={sellToken}
          toToken={buyToken}
          fromAmount={sellAmount}
          toAmount={buyAmount}
          fromUsdValue={`$${sellToken === "ETH" ? (parseFloat(sellAmount || "0") * 2300).toFixed(2) : (parseFloat(sellAmount || "0") * 0.01).toFixed(2)}`}
          toUsdValue={`$${buyToken === "ETH" ? (parseFloat(buyAmount || "0") * 2300).toFixed(2) : (parseFloat(buyAmount || "0") * 0.01).toFixed(2)}`}
          exchangeRate={exchangeRate}
          onConfirm={handleConfirmSwap}
          isSwapping={isSwapping}
        />
      )}

      {/* Token Selector Modals */}
      <TokenSelectorModal
        open={showSellTokenSelector}
        onOpenChange={setShowSellTokenSelector}
        onSelectToken={(token) => handleTokenSelect("sell", token)}
        selectedToken={sellToken}
        excludeToken={buyToken}
        customTokens={customTokens}
        onAddCustomToken={handleAddCustomToken}
      />
      <TokenSelectorModal
        open={showBuyTokenSelector}
        onOpenChange={setShowBuyTokenSelector}
        onSelectToken={(token) => handleTokenSelect("buy", token)}
        selectedToken={buyToken}
        excludeToken={sellToken}
        customTokens={customTokens}
        onAddCustomToken={handleAddCustomToken}
      />
    </div>
  )
}
