"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { ArrowDown, ChevronDown, Loader2, Settings, Info, Search, X, Plus } from "lucide-react"
import { useAccount, useBalance } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"

import { cn, formatBalance } from "@/lib/utils"
import { formatUnits } from "viem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SwapReviewModal } from "./SwapReviewModal"
import {
  useQuote,
  formatQuoteAmount,
  formatPriceImpact,
  getPriceImpactSeverity,
} from "@/hooks/use-quote"
import tokenList from "@/lib/token-list.json"

// Token setup
// Popular tokens for quick access
const POPULAR_TOKEN_SYMBOLS = ["ETH", "USDC", "USDT", "WBTC", "DAI"]

// Create tokens from the JSON list
const createTokensFromList = (tokenList: any[]): Record<string, Token> => {
  const tokens: Record<string, Token> = {}

  tokenList.forEach((token) => {
    const isPopular = POPULAR_TOKEN_SYMBOLS.includes(token.symbol)

    tokens[token.symbol] = {
      symbol: token.symbol,
      name: token.name,
      icon: (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className="h-full w-full object-contain"
          onError={(e) => {
            // Fallback to default icon on error
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
      ),
      balance: "0.00", // Will be updated with real balance
      address: token.address,
      decimals: token.decimals,
      popular: isPopular,
    }
  })

  return tokens
}

type TokenKey =
  | "ETH"
  | "USDC"
  | "USDT"
  | "WBTC"
  | "DAI"
  | "LINK"
  | "UNI"
  | "AAVE"
  | "ARB"
  | "OP"
  | "MATIC"
  | "WETH" // TODO: Add "FAST" when token is available
type TokenType = TokenKey | string | null

interface Token {
  symbol: string
  name: string
  icon: React.ReactNode
  balance: string
  address?: string
  decimals?: number
  popular?: boolean
}

// Create the TOKENS object from the JSON list
const TOKENS: Record<string, Token> = createTokensFromList(tokenList)

// Default icon for custom tokens
const DEFAULT_TOKEN_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#6B7280" />
    <text x="16" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
      ?
    </text>
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
  const tokenData = allTokens[token] || {
    symbol: token,
    name: "Custom Token",
    icon: DEFAULT_TOKEN_ICON,
    balance: "0.00",
  }
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
  const popularTokens = Object.entries(TOKENS).filter(
    ([key, token]) => token.popular && key !== excludeToken
  )
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
                  selectedToken === key ? "bg-primary/10" : "hover:bg-muted/30"
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

// Animated Background Orbs - Fixed to viewport
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none z-0">
      {/* Primary orb */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 sm:w-[500px] sm:h-[500px] rounded-full bg-primary/20 blur-3xl animate-pulse" />
      {/* Secondary orb */}
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 sm:w-[500px] sm:h-[500px] rounded-full bg-pink-500/15 blur-3xl animate-pulse [animation-delay:1s]" />
      {/* Accent orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-accent/10 blur-3xl animate-pulse [animation-delay:2s]" />
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
  const [isSwapping, setIsSwapping] = useState(false)
  const [sellToken, setSellToken] = useState<TokenType>("ETH")
  const [buyToken, setBuyToken] = useState<TokenType>(null)
  const [slippage, setSlippage] = useState("0.5")
  const [customSlippage, setCustomSlippage] = useState("")
  const [deadline, setDeadline] = useState("30")
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSellTokenSelector, setShowSellTokenSelector] = useState(false)
  const [showBuyTokenSelector, setShowBuyTokenSelector] = useState(false)
  const [customTokens, setCustomTokens] = useState<Record<string, Token>>({})
  const sellInputRef = useRef<HTMLInputElement>(null)

  // Get tokens that need balance fetching (selected + popular tokens)
  const tokensToFetchBalance = useMemo(() => {
    const tokens = new Set<TokenType>()

    // Add selected tokens
    if (sellToken) tokens.add(sellToken)
    if (buyToken) tokens.add(buyToken)

    // Add popular tokens
    POPULAR_TOKEN_SYMBOLS.forEach((symbol) => tokens.add(symbol as TokenType))

    return Array.from(tokens).filter((token) => token && TOKENS[token])
  }, [sellToken, buyToken])

  // Create balance hooks for each token that needs fetching
  const balanceQueries = tokensToFetchBalance.map((tokenSymbol) => {
    const token = TOKENS[tokenSymbol]
    return {
      symbol: tokenSymbol,
      query: useBalance({
        address: isConnected && address ? address : undefined,
        token:
          token?.address && token.address !== "0x0000000000000000000000000000000000000000"
            ? (token.address as `0x${string}`)
            : undefined,
        query: {
          enabled: isConnected && !!address && !!token,
        },
      }),
    }
  })

  // Process balance data
  const tokenBalances = useMemo(() => {
    const balances: Record<string, string> = {}

    balanceQueries.forEach(({ symbol, query }) => {
      const { data, isLoading } = query
      const token = TOKENS[symbol]

      if (isLoading) {
        balances[symbol] = "Loading..."
      } else if (data && token) {
        // Format the balance using formatUnits and token decimals
        const balanceValue = parseFloat(formatUnits(data.value, token.decimals || 18))
        balances[symbol] = formatBalance(balanceValue, symbol)
      } else {
        balances[symbol] = "0.00"
      }
    })

    return balances
  }, [balanceQueries])

  // Create tokens with real balances
  const tokensWithBalances = useMemo(() => {
    const tokens = { ...TOKENS, ...customTokens }

    Object.keys(tokens).forEach((tokenSymbol) => {
      if (tokenBalances[tokenSymbol]) {
        tokens[tokenSymbol] = {
          ...tokens[tokenSymbol],
          balance: tokenBalances[tokenSymbol],
        }
      }
    })

    return tokens
  }, [tokenBalances, customTokens])

  // Real quote fetching from Uniswap V3
  const {
    quote,
    isLoading: isQuoteLoading,
    error: quoteError,
  } = useQuote({
    tokenIn: sellToken || "",
    tokenOut: buyToken || "",
    amountIn: sellAmount,
    slippage,
    enabled: !!(sellToken && buyToken && sellAmount && parseFloat(sellAmount) > 0),
  })

  // Derive buyAmount and exchangeRate from quote
  const buyAmount = quote?.amountOutFormatted || ""
  const exchangeRate = quote?.exchangeRate || 0
  const priceImpact = quote?.priceImpact ?? 0
  const minOut = quote?.minOutFormatted || ""

  const handleSwapTokens = () => {
    const tempToken = sellToken
    setSellToken(buyToken)
    setBuyToken(tempToken)
    // When swapping, use the current quote output as the new input
    if (buyAmount) {
      setSellAmount(buyAmount)
    }
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
        decimals: 18, // Default to 18 decimals for custom tokens
      },
    }))
  }

  const allTokens = { ...tokensWithBalances }

  const isSwapReady = sellAmount && sellToken && buyToken && isConnected && !isQuoteLoading
  const priceImpactDisplay = quote ? formatPriceImpact(priceImpact) : "-"
  const priceImpactSeverity = getPriceImpactSeverity(priceImpact)

  return (
    <div className="relative flex flex-col items-center justify-start px-4 pt-2 sm:pt-6 pb-4">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Hero Section */}
      <div className="relative z-10 text-center mb-4 sm:mb-5 max-w-3xl">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold pb-2 sm:pb-3 mb-2 sm:mb-2 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent leading-tight">
          Lightning-fast swaps
        </h1>
        <p className="text-sm sm:text-lg text-muted-foreground px-4 sm:px-0">
          Trade crypto on Ethereum with fast execution and mev rewards
        </p>
      </div>

      {/* Swap Interface - No outer card wrapper */}
      <div className="relative z-10 w-full max-w-[500px] px-2 sm:px-0">
        {/* Header - Above both cards */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-xl font-semibold text-white">Swap</span>
          <Popover open={showSettings} onOpenChange={setShowSettings}>
            <PopoverTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <Settings className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 bg-[#1c2128] border-white/10 p-4">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white">Transaction Settings</h3>

                {/* Slippage Tolerance */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Slippage tolerance</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-gray-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px]">
                          <p className="text-xs">
                            Your transaction will revert if the price changes unfavorably by more
                            than this percentage.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex gap-2">
                    {["0.1", "0.5", "1.0"].map((value) => (
                      <button
                        key={value}
                        onClick={() => {
                          setSlippage(value)
                          setCustomSlippage("")
                        }}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                          slippage === value && !customSlippage
                            ? "bg-primary text-white"
                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {value}%
                      </button>
                    ))}
                    <div className="relative flex-1">
                      <input
                        type="number"
                        placeholder="Custom"
                        value={customSlippage}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomSlippage(val)
                          if (val && parseFloat(val) > 0) {
                            setSlippage(val)
                          }
                        }}
                        className={cn(
                          "w-full py-2 px-3 rounded-lg text-sm font-medium bg-white/5 border transition-colors text-right pr-6",
                          customSlippage
                            ? "border-primary text-white"
                            : "border-transparent text-gray-400 hover:bg-white/10"
                        )}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        %
                      </span>
                    </div>
                  </div>
                  {parseFloat(slippage) > 5 && (
                    <p className="text-xs text-yellow-500">
                      ⚠️ High slippage may result in unfavorable trades
                    </p>
                  )}
                  {parseFloat(slippage) < 0.1 && (
                    <p className="text-xs text-yellow-500">
                      ⚠️ Low slippage may cause transaction to fail
                    </p>
                  )}
                </div>

                {/* Transaction Deadline */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Transaction deadline</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-gray-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px]">
                          <p className="text-xs">
                            Your transaction will revert if it is pending for more than this period
                            of time.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-20 py-2 px-3 rounded-lg text-sm font-medium bg-white/5 border border-transparent text-white text-right focus:border-primary focus:outline-none"
                    />
                    <span className="text-sm text-gray-400">minutes</span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Stacked Sell/Buy cards */}
        <div className="relative flex flex-col">
          {/* Sell Card */}
          <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Sell
              </span>
              {sellToken && allTokens[sellToken] && (
                <span className="text-xs text-gray-500">
                  Balance: {allTokens[sellToken].balance}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <input
                  ref={sellInputRef}
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="0"
                  className="w-full border-0 bg-transparent p-0 text-white h-auto focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none tracking-tight text-[28px] sm:text-[36px] font-semibold leading-[34px] sm:leading-[42px]"
                />
                {sellAmount && sellToken && (
                  <div className="mt-1 text-sm text-gray-500 font-medium">
                    ≈ $
                    {sellToken === "ETH"
                      ? (parseFloat(sellAmount) * 2300).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : (parseFloat(sellAmount) * 0.01).toFixed(2)}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowSellTokenSelector(true)}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0",
                  sellToken && allTokens[sellToken]
                    ? "bg-white/10 hover:bg-white/15 text-white"
                    : "bg-primary hover:bg-primary/90 text-white"
                )}
              >
                {sellToken && allTokens[sellToken] ? (
                  <>
                    <div className="h-6 w-6">{allTokens[sellToken].icon}</div>
                    {allTokens[sellToken].symbol}
                  </>
                ) : (
                  "Select token"
                )}
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Swap Arrow Button - Between cards */}
          <div className="flex justify-center -my-3 relative z-20">
            <button
              onClick={handleSwapTokens}
              className="h-9 w-9 rounded-full bg-[#0d1117] border-4 border-[#161b22] flex items-center justify-center hover:bg-[#1c2128] transition-all active:scale-90 group shadow-lg"
            >
              <ArrowDown className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors group-hover:rotate-180 duration-300" />
            </button>
          </div>

          {/* Buy Card */}
          <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Buy</span>
              {buyToken && allTokens[buyToken] && (
                <span className="text-xs text-gray-500">
                  Balance: {allTokens[buyToken].balance}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {isQuoteLoading && sellAmount && sellToken && buyToken ? (
                  <div className="flex items-center gap-2 h-[34px] sm:h-[42px]">
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 animate-spin" />
                    <span className="text-gray-500 text-xl sm:text-2xl font-medium">
                      Fetching...
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={buyAmount ? formatQuoteAmount(buyAmount) : ""}
                    readOnly
                    placeholder="0"
                    className="w-full border-0 bg-transparent p-0 text-gray-400 h-auto focus:outline-none tracking-tight text-[28px] sm:text-[36px] font-semibold leading-[34px] sm:leading-[42px]"
                  />
                )}
                {buyAmount && buyToken && !isQuoteLoading && (
                  <div className="mt-1 text-sm text-gray-500 font-medium">
                    ≈ $
                    {buyToken === "ETH"
                      ? (parseFloat(buyAmount) * 2300).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : (parseFloat(buyAmount) * 0.01).toFixed(2)}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowBuyTokenSelector(true)}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0",
                  buyToken && allTokens[buyToken]
                    ? "bg-white/10 hover:bg-white/15 text-white"
                    : "bg-primary hover:bg-primary/90 text-white"
                )}
              >
                {buyToken && allTokens[buyToken] ? (
                  <>
                    <div className="h-6 w-6">{allTokens[buyToken].icon}</div>
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

        {/* Exchange Rate Info - Below both cards */}
        {sellToken && buyToken && (
          <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl bg-white/5 border border-white/5 px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                {isQuoteLoading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Fetching rate...
                  </span>
                ) : exchangeRate > 0 ? (
                  `1 ${sellToken} = ${formatQuoteAmount(exchangeRate.toString())} ${buyToken}`
                ) : (
                  "Select tokens to see rate"
                )}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1",
                  priceImpactSeverity === "low" && "text-green-400",
                  priceImpactSeverity === "medium" && "text-yellow-400",
                  priceImpactSeverity === "high" && "text-red-400"
                )}
              >
                Price Impact: {priceImpactDisplay}
                {priceImpactSeverity === "high" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>High price impact - consider reducing trade size</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
            </div>
          </div>
        )}

        {/* CTA Button - Full width spanning both cards */}
        <div className="mt-3 sm:mt-4">
          {!isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <Button
                  onClick={openConnectModal}
                  className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-gradient-to-r from-pink-500 to-primary hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  Connect Wallet
                </Button>
              )}
            </ConnectButton.Custom>
          ) : !buyToken ? (
            <Button
              disabled
              className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-not-allowed"
            >
              Select a token
            </Button>
          ) : !sellAmount ? (
            <Button
              disabled
              className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-not-allowed"
            >
              Enter an amount
            </Button>
          ) : (
            <Button
              onClick={handleSwapClick}
              className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-gradient-to-r from-pink-500 to-primary hover:opacity-90 transition-all active:scale-[0.98]"
            >
              Swap
            </Button>
          )}
        </div>

        {/* Rewards Badge */}
        <div className="mt-3 sm:mt-4 flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 backdrop-blur-sm">
            <div className="relative flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <div className="absolute h-2 w-2 rounded-full bg-primary animate-ping opacity-75" />
            </div>
            <span className="text-[11px] sm:text-xs font-medium text-primary">
              Earning Fast Rewards
            </span>
            <img
              src="/assets/fast-icon.png"
              alt="Fast"
              className="h-7 w-7 sm:h-8 sm:w-8"
              style={{ background: "transparent" }}
            />
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
          minOut={minOut}
          priceImpact={priceImpact}
          slippage={slippage}
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
