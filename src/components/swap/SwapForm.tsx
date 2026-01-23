"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  ArrowDown,
  ChevronDown,
  Loader2,
  Settings,
  Info,
  Search,
  X,
  Plus,
  Wallet,
} from "lucide-react"
import { useAccount, useBalance } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { formatUnits } from "viem"

import { cn, formatBalance } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SwapReviewModal } from "./SwapReviewModal"
import AmountInput from "./AmountInput"
import TokenInfoRow from "./TokenInfoRow"
import {
  useQuote,
  formatQuoteAmount,
  formatPriceImpact,
  getPriceImpactSeverity,
  calculateAutoSlippage,
  type QuoteResult,
} from "@/hooks/use-quote-v2"
import { useToast } from "@/hooks/use-toast"
import { useTokenPrice } from "@/hooks/use-token-price"
import { useGasPrice } from "@/hooks/use-gas-price"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { isWrapUnwrapPair } from "@/lib/weth-utils"
import tokenList from "@/lib/token-list.json"
import type { Token } from "@/types/swap"
import { ZERO_ADDRESS } from "@/lib/swap-constants"

const tokens = tokenList as Token[]

const DEFAULT_ETH_TOKEN: Token = {
  address: ZERO_ADDRESS,
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
  logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
}

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

  // Deduplicate tokens by symbol to prevent React key conflicts
  // Deduplicate by address (which is always unique)
  const uniqueTokens = tokens.reduce((acc, token) => {
    const key = token.address.toLowerCase()
    if (!acc.has(key)) {
      acc.set(key, token)
    }
    return acc
  }, new Map<string, Token>())

  const deduplicatedTokens = Array.from(uniqueTokens.values())

  const popularTokens = deduplicatedTokens.filter(
    (token) =>
      token.symbol !== excludeToken && ["ETH", "USDC", "USDT", "WBTC", "DAI"].includes(token.symbol)
  )
  const allTokenList = deduplicatedTokens.filter((token) => token.symbol !== excludeToken)

  const filteredTokens = searchQuery
    ? allTokenList.filter(
        (token) =>
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
                key={token.symbol}
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
  const { toast } = useToast()

  // Token state
  const [fromToken, setFromToken] = useState<Token | undefined>(DEFAULT_ETH_TOKEN)
  const [toToken, setToToken] = useState<Token | undefined>(undefined)

  // Amount state
  const [amount, setAmount] = useState("")
  const [editingSide, setEditingSide] = useState<"sell" | "buy">("sell")

  // UI state
  const [isReviewAccordionOpen, setIsReviewAccordionOpen] = useState(false)
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isFromTokenSelectorOpen, setIsFromTokenSelectorOpen] = useState(false)
  const [isToTokenSelectorOpen, setIsToTokenSelectorOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [preservedDisplayQuote, setPreservedDisplayQuote] = useState<string | null>(null)
  const [swappedQuote, setSwappedQuote] = useState<QuoteResult | null>(null)
  const [swappedFromTokenPrice, setSwappedFromTokenPrice] = useState<number | null>(null)
  const [swappedToTokenPrice, setSwappedToTokenPrice] = useState<number | null>(null)
  const [isManualInversion, setIsManualInversion] = useState(false)

  // Settings state
  const [internalSlippage, setInternalSlippage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("swapSlippage") || "0.5"
    }
    return "0.5"
  })
  const [isAutoSlippage, setIsAutoSlippage] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("swapSlippageAuto") === "true"
    }
    return false
  })
  const [internalDeadline, setInternalDeadline] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("swapDeadline")
      return saved ? parseInt(saved, 10) : 30
    }
    return 30
  })

  // Refs
  const sellInputRef = useRef<HTMLInputElement>(null)
  const buyInputRef = useRef<HTMLInputElement>(null)

  // Settings computed values
  const slippage = internalSlippage
  const deadline = internalDeadline

  const handleSlippageChange = (newSlippage: string) => {
    setInternalSlippage(newSlippage)
    localStorage.setItem("swapSlippage", newSlippage)
  }

  const handleDeadlineChange = (newDeadline: number) => {
    setInternalDeadline(newDeadline)
    localStorage.setItem("swapDeadline", newDeadline.toString())
  }

  const handleAutoSlippageChange = (isAuto: boolean) => {
    setIsAutoSlippage(isAuto)
    localStorage.setItem("swapSlippageAuto", isAuto.toString())
  }

  // Price hooks
  const { price: fromTokenPrice, isLoading: isLoadingFromPrice } = useTokenPrice(
    fromToken?.symbol || ""
  )
  const { price: toTokenPrice, isLoading: isLoadingToPrice } = useTokenPrice(toToken?.symbol || "")
  const { price: ethPrice } = useTokenPrice("ETH")
  const { gasPrice, gasPriceGwei } = useGasPrice()

  // Detect wrap/unwrap operations
  const isWrapUnwrap = isWrapUnwrapPair(fromToken, toToken)

  // Wrap/unwrap hook
  const {
    isWrap,
    isUnwrap,
    gasEstimate: wrapUnwrapGasEstimate,
    isLoadingGas: isLoadingWrapUnwrapGas,
    wrap,
    unwrap,
    isPending: isWrapUnwrapPending,
    isConfirming: isWrapUnwrapConfirming,
    isSuccess: isWrapUnwrapSuccess,
    error: wrapUnwrapError,
    hash: wrapUnwrapHash,
  } = useWethWrapUnwrap({
    fromToken,
    toToken,
    amount,
    enabled: isWrapUnwrap && !!amount && parseFloat(amount) > 0,
  })

  // Handle wrap/unwrap success
  useEffect(() => {
    if (isWrapUnwrapSuccess) {
      toast({
        title: isWrap ? "ETH Wrapped" : "WETH Unwrapped",
        description: `Successfully ${isWrap ? "wrapped" : "unwrapped"} ${amount} ${isWrap ? "ETH" : "WETH"}`,
      })
      setAmount("")
    }
  }, [isWrapUnwrapSuccess, isWrap, amount, toast])

  // Handle wrap/unwrap errors
  useEffect(() => {
    if (wrapUnwrapError && (wrapUnwrapHash || isWrapUnwrapPending || isWrapUnwrapConfirming)) {
      const operation = isWrap ? "wrap" : isUnwrap ? "unwrap" : "transaction"

      toast({
        title: `Transaction Error`,
        description: `Failed to ${operation}. Please try again.`,
        variant: "destructive",
      })
    }
  }, [
    wrapUnwrapError,
    wrapUnwrapHash,
    isWrapUnwrapPending,
    isWrapUnwrapConfirming,
    isWrap,
    isUnwrap,
    toast,
  ])

  // Calculate auto slippage if enabled
  const calculatedAutoSlippage = useMemo(() => {
    if (!isAutoSlippage || !amount || parseFloat(amount) <= 0 || !fromToken || !toToken) {
      return null
    }
    const tradeAmount = parseFloat(amount)
    return calculateAutoSlippage(tradeAmount, fromToken, toToken, gasPriceGwei)
  }, [isAutoSlippage, amount, fromToken, toToken, gasPriceGwei])

  // Use auto slippage if enabled, otherwise use manual slippage
  const effectiveSlippage =
    isAutoSlippage && calculatedAutoSlippage !== null ? calculatedAutoSlippage.toFixed(2) : slippage

  // Quote timer state
  const [timeLeft, setTimeLeft] = useState(15)
  const hasRefetchedRef = useRef(false)
  const justSwitchedSamePairRef = useRef(false)

  // Balance checking
  const [insufficientBalance, setInsufficientBalance] = useState(false)

  // Quote hook
  const {
    quote,
    isLoading: isQuoteLoading,
    error: quoteError,
    noLiquidity,
    refetch,
  } = useQuote({
    tokenIn: fromToken,
    tokenOut: toToken,
    amountIn: amount,
    slippage: effectiveSlippage,
    debounceMs: 100,
    tradeType: editingSide === "sell" ? "exactIn" : "exactOut",
    tokenList: tokens,
    enabled:
      !isSwitching &&
      !!amount &&
      parseFloat(amount) > 0 &&
      !!fromToken &&
      !!toToken &&
      !isWrapUnwrap, // Disable quote fetching for wrap/unwrap
  })

  // Use swapped quote if available (for same-token-pair switches), otherwise use fetched quote
  // Replace your existing activeQuote logic with this:
  const activeQuote = useMemo(() => {
    // If we just performed a manual switch, use the inverted local data
    if (isManualInversion && swappedQuote) {
      return swappedQuote
    }
    return quote
  }, [isManualInversion, swappedQuote, quote])

  // Use swapped prices if available (for same-token-pair switches), otherwise use fetched prices
  const activeFromTokenPrice =
    swappedFromTokenPrice !== null ? swappedFromTokenPrice : fromTokenPrice
  const activeToTokenPrice = swappedToTokenPrice !== null ? swappedToTokenPrice : toTokenPrice

  // Balance hooks
  const { data: fromBalance, isLoading: isLoadingFromBalance } = useBalance({
    address: isConnected && address ? address : undefined,
    token:
      fromToken?.address && fromToken.address !== ZERO_ADDRESS
        ? (fromToken.address as `0x${string}`)
        : undefined,
    query: {
      enabled: isConnected && !!address && !!fromToken,
    },
  })

  const { data: toBalance, isLoading: isLoadingToBalance } = useBalance({
    address: isConnected && address ? address : undefined,
    token:
      toToken?.address && toToken.address !== ZERO_ADDRESS
        ? (toToken.address as `0x${string}`)
        : undefined,
    query: {
      enabled: isConnected && !!address && !!toToken,
    },
  })

  const fromBalanceValue =
    fromBalance && fromToken ? parseFloat(formatUnits(fromBalance.value, fromToken.decimals)) : 0
  const formattedFromBalance = formatBalance(fromBalanceValue, fromToken?.symbol)

  const toBalanceValue =
    toBalance && toToken ? parseFloat(formatUnits(toBalance.value, toToken.decimals)) : 0
  const formattedToBalance = formatBalance(toBalanceValue, toToken?.symbol)

  // Display quote logic
  const displayQuote = useMemo(() => {
    // For wrap/unwrap, we pass amount directly to components, so return null here
    // This prevents any quote logic from interfering with wrap/unwrap display
    if (isWrapUnwrap) {
      return null
    }

    // For regular swaps, use quote
    if (activeQuote) {
      return editingSide === "sell" ? activeQuote.amountOutFormatted : activeQuote.amountInFormatted
    }
    // If no quote but we have preserved value, use it (during switch transition)
    if (preservedDisplayQuote) {
      return preservedDisplayQuote
    }
    return null
  }, [activeQuote, editingSide, preservedDisplayQuote, isWrapUnwrap])

  // For wrap/unwrap, use amount directly (1:1)
  // For regular swaps, use displayQuote or fallback to "0"
  const outputAmount = isWrapUnwrap ? amount : displayQuote || "0"

  // For wrap/unwrap, use wrap/unwrap gas loading state
  // For wrap/unwrap, no pulse animation needed (no quote loading)
  const effectiveQuoteLoading = isWrapUnwrap ? isLoadingWrapUnwrapGas : isQuoteLoading

  // Calculate display values for each input based on editing side
  const sellDisplayValue = useMemo(() => {
    if (isSwitching && preservedDisplayQuote) return preservedDisplayQuote
    return amount
  }, [isSwitching, preservedDisplayQuote, amount])

  // This logic ensures that DURING a switch, we show the "Frozen" old Sell value
  // in the Buy box, instead of "Fetching..." or "0".
  // Inside SwapForm.tsx
  const buyDisplayValue = useMemo(() => {
    // Priority 1: If we are switching tokens, show the frozen value (the old Sell value)
    if (isSwitching && preservedDisplayQuote) {
      return preservedDisplayQuote
    }

    // Priority 2: If the user is manually typing in the Buy box
    if (editingSide === "buy") return amount

    // Priority 3: Fallback to the active quote from the hook
    if (displayQuote) return displayQuote

    // Priority 4: Loading or placeholder states
    return effectiveQuoteLoading ? "Fetching..." : "0"
  }, [isSwitching, preservedDisplayQuote, editingSide, amount, displayQuote, effectiveQuoteLoading])

  // Insufficient balance checking
  useEffect(() => {
    if (!isConnected) {
      setInsufficientBalance(false)
      return
    }

    const amountStr = String(amount || "").trim()
    if (!amountStr || amountStr === "" || amountStr === "0") {
      setInsufficientBalance(false)
      return
    }

    const amountValue = parseFloat(amountStr)
    if (isNaN(amountValue) || amountValue <= 0) {
      setInsufficientBalance(false)
      return
    }

    // Always check fromToken (sell token) balance, regardless of editingSide
    if (!fromToken) {
      setInsufficientBalance(false)
      return
    }

    // If balance is still loading, don't show insufficient balance error yet
    // This prevents false positives during token switches
    if (isLoadingFromBalance) {
      setInsufficientBalance(false)
      return
    }

    // Ensure we have balance data (not just that loading finished)
    if (!fromBalance) {
      setInsufficientBalance(false)
      return
    }

    // Calculate the amount to check based on editingSide
    let amountToCheck = amountValue

    if (editingSide === "buy") {
      // For wrap/unwrap pairs, it's 1:1 so use amount directly
      if (isWrapUnwrap) {
        amountToCheck = amountValue
      } else if (activeQuote?.amountInFormatted) {
        // When editing buy side, amount is the desired output (toToken)
        // We need to check if we have enough fromToken to get that amount
        const cleanAmountIn = activeQuote.amountInFormatted.replace(/,/g, "")
        const amountInNeeded = parseFloat(cleanAmountIn)
        if (!isNaN(amountInNeeded) && amountInNeeded > 0) {
          amountToCheck = amountInNeeded
        }
      } else {
        // No quote yet, can't determine if we have enough
        setInsufficientBalance(false)
        return
      }
    }

    // If paying in native ETH, account for gas costs
    let availableBalance = fromBalanceValue
    if (fromToken.address === ZERO_ADDRESS && gasPrice) {
      let gasEstimate: bigint | null = null

      // For wrap/unwrap operations, use wrap/unwrap gas estimate
      if (isWrapUnwrap && isWrap && wrapUnwrapGasEstimate) {
        gasEstimate = wrapUnwrapGasEstimate
      }
      // For regular swaps, use quote gas estimate
      else if (!isWrapUnwrap && activeQuote?.gasEstimate) {
        gasEstimate = activeQuote.gasEstimate
      }

      if (gasEstimate) {
        const gasCostEth = (Number(gasEstimate) * Number(gasPrice)) / 1e18
        availableBalance = Math.max(0, fromBalanceValue - gasCostEth)
      }
    }

    // More generous tolerance for precision issues and small differences
    const tolerance = Math.max(availableBalance * 0.01, Math.pow(10, -fromToken.decimals), 0.000001)
    const exceedsBalance = amountToCheck > availableBalance + tolerance

    setInsufficientBalance(exceedsBalance)
  }, [
    amount,
    fromBalance,
    fromToken,
    editingSide,
    isConnected,
    fromBalanceValue,
    displayQuote,
    quote,
    activeQuote,
    gasPrice,
    isWrapUnwrap,
    isWrap,
    wrapUnwrapGasEstimate,
  ])

  // Token selection handlers
  const handleFromTokenSelect = useCallback(
    (token: Token | undefined) => {
      setFromToken(token)

      // If we have an amount, don't wait for the debounce timer
      if (amount && parseFloat(amount) > 0 && token) {
        // We use a small timeout to ensure React has flushed
        // the 'fromToken' state update before the refetch starts
        setTimeout(() => {
          refetch()
        }, 0)
      }
    },
    [amount, refetch]
  )

  const handleToTokenSelect = useCallback(
    (token: Token | undefined) => {
      setToToken(token)

      if (amount && parseFloat(amount) > 0 && token) {
        setTimeout(() => {
          refetch()
        }, 0)
      }
    },
    [amount, refetch]
  )

  // Token switching logic
  const handleSwitch = useCallback(() => {
    if (!fromToken || !toToken || !activeQuote) return

    // 1. Tell the UI and Quote Hook to pause
    setIsSwitching(true)
    setIsManualInversion(true)

    // 2. Capture current values
    const oldSellToken = fromToken
    const oldBuyToken = toToken
    const oldSellAmount = amount
    const oldBuyAmount = activeQuote.amountOutFormatted.replace(/,/g, "")

    // 3. Manually invert the quote object so the UI remains accurate
    const invertedQuote: QuoteResult = {
      ...activeQuote,
      amountIn: activeQuote.amountOut,
      amountInFormatted: activeQuote.amountOutFormatted,
      amountOut: activeQuote.amountIn,
      amountOutFormatted: activeQuote.amountInFormatted,
      // The exchange rate is simply inverted (1 / rate)
      exchangeRate: 1 / activeQuote.exchangeRate,
      // Price impact usually remains similar but can be inverted for display
      priceImpact: activeQuote.priceImpact,
    }

    // 4. Update the Tokens and Amount
    setFromToken(oldBuyToken)
    setToToken(oldSellToken)
    setAmount(oldBuyAmount)
    setSwappedQuote(invertedQuote)
    setEditingSide("sell")

    // 5. Keep the 'Mute' on for a moment to prevent the hook from firing
    // on the token change.
    setTimeout(() => {
      setIsSwitching(false)
    }, 100)
  }, [fromToken, toToken, activeQuote, amount])

  useEffect(() => {
    // Don't run timer for wrap/unwrap
    if (isWrapUnwrap) return

    // Run if we have any valid quote data (either from hook or manual switch)
    if (!activeQuote || isSwitching) {
      setTimeLeft(15)
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // When the timer hits zero, we MUST trigger a real fetch
          // to turn our manual estimate into a real blockchain quote
          setIsManualInversion(false)
          refetch()
          return 15
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [activeQuote, isSwitching, isWrapUnwrap, refetch])

  const exchangeRateContent = useMemo(() => {
    // 1. Loading State - Only show if we aren't performing a manual switch
    if (effectiveQuoteLoading && !isManualInversion) {
      return (
        <span className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Fetching rate...
        </span>
      )
    }

    // 2. Wrap/Unwrap Case (Always 1:1)
    if (isWrapUnwrap) {
      return `1 ${fromToken?.symbol} = 1 ${toToken?.symbol}`
    }

    // 3. Active Quote Case (Handles both Hook data and Swapped/Manual data)
    if (activeQuote?.exchangeRate) {
      const formattedRate = formatQuoteAmount(activeQuote.exchangeRate.toString())
      return `1 ${fromToken?.symbol} = ${formattedRate} ${toToken?.symbol}`
    }

    // 4. Default Fallback
    return "Select tokens to see rate"
  }, [effectiveQuoteLoading, isManualInversion, isWrapUnwrap, fromToken, toToken, activeQuote])

  const handleSwapClick = () => {
    if (!isConnected) {
      // This should be handled by the ConnectButton
      return
    }

    if (!fromToken || !toToken) {
      toast({
        title: "Select Tokens",
        description: "Please select both input and output tokens",
        variant: "destructive",
      })
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Enter Amount",
        description: "Please enter an amount to swap",
        variant: "destructive",
      })
      return
    }

    if (insufficientBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You don't have enough ${editingSide === "sell" ? fromToken.symbol : toToken.symbol} to complete this swap`,
        variant: "destructive",
      })
      return
    }

    // For wrap/unwrap, bypass quote validation
    if (isWrapUnwrap) {
      setIsConfirmationOpen(true)
      return
    }

    if (quoteError) {
      toast({
        title: "Quote Error",
        description: quoteError.message || "Failed to fetch quote. Please try again.",
        variant: "destructive",
      })
      return
    }

    if (!quote) {
      toast({
        title: "No Quote Available",
        description: "Please wait for the quote to load or check if liquidity is available",
        variant: "destructive",
      })
      return
    }

    const hasVeryHighPriceImpact = activeQuote ? Math.abs(activeQuote.priceImpact) > 10 : false
    if (hasVeryHighPriceImpact) {
      toast({
        title: "Price Impact Too High",
        description:
          "Price impact exceeds 10%. This swap may result in significant loss. Please reduce the swap amount.",
        variant: "destructive",
      })
      return
    }

    setIsConfirmationOpen(true)
  }

  const handleConfirmSwap = async () => {
    setIsConfirmationOpen(false)

    // Handle wrap/unwrap transactions
    if (isWrapUnwrap) {
      if (isWrap) {
        wrap()
      } else if (isUnwrap) {
        unwrap()
      }
      return
    }

    // Handle regular swap
    // This would need to be implemented with the actual swap confirmation hook
    toast({
      title: "Swap Submitted",
      description: "Your swap transaction has been submitted to the network.",
    })
    setAmount("")
  }

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
          <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <PopoverTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <Settings className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 bg-[#1c2128] border-white/10 p-4">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white">Transaction Settings</h3>

                {/* Auto Slippage Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Auto slippage</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-gray-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px]">
                          <p className="text-xs">
                            Automatically adjust slippage based on trade size and market conditions.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <button
                    onClick={() => handleAutoSlippageChange(!isAutoSlippage)}
                    className={cn(
                      "w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                      isAutoSlippage
                        ? "bg-primary text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {isAutoSlippage ? "Enabled" : "Disabled"}
                    {isAutoSlippage && calculatedAutoSlippage && (
                      <span className="ml-2 text-xs opacity-75">
                        ({calculatedAutoSlippage.toFixed(2)}%)
                      </span>
                    )}
                  </button>
                </div>

                {/* Manual Slippage Tolerance */}
                {!isAutoSlippage && (
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
                            handleSlippageChange(value)
                          }}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                            slippage === value
                              ? "bg-primary text-white"
                              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          {value}%
                        </button>
                      ))}
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
                )}

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
                      value={deadline}
                      onChange={(e) => handleDeadlineChange(parseInt(e.target.value) || 30)}
                      className="w-20 py-2 px-3 rounded-lg text-center text-sm font-medium bg-white/5 border border-transparent text-white text-center focus:border-primary focus:outline-none"
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
              {fromToken && (
                <span className="flex items-center gap-1 text-sm font-medium text-white/70">
                  <Wallet size={14} /> {formattedFromBalance}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <AmountInput
                  value={sellDisplayValue}
                  onChange={(value) => {
                    // Inside your amount change handler (AmountInput onChange)
                    setIsManualInversion(false)
                    setSwappedQuote(null)
                    // setEditingSide("sell")
                    setAmount(value)
                  }}
                  onFocus={() => setEditingSide("sell")}
                  onBlur={() => {}}
                  isActive={editingSide === "sell"}
                  isDisabled={false}
                  showError={insufficientBalance}
                  isQuoteLoading={effectiveQuoteLoading}
                  inputRef={sellInputRef}
                />
                <TokenInfoRow
                  displayAmount={amount}
                  tokenPrice={activeFromTokenPrice}
                  isLoadingPrice={isLoadingFromPrice}
                  token={fromToken}
                  balance={fromBalance}
                  balanceValue={fromBalanceValue}
                  formattedBalance={formattedFromBalance}
                  isLoadingBalance={isLoadingFromBalance}
                  isConnected={isConnected}
                  address={address}
                  showError={insufficientBalance}
                  side="sell"
                />
              </div>
              <button
                onClick={() => setIsFromTokenSelectorOpen(true)}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0",
                  fromToken
                    ? "bg-white/10 hover:bg-white/15 text-white"
                    : "bg-primary hover:bg-primary/90 text-white"
                )}
              >
                {fromToken ? (
                  <>
                    <div className="h-6 w-6">
                      <img
                        src={fromToken.logoURI}
                        alt={fromToken.symbol}
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
                                  ${fromToken.symbol.charAt(0)}
                                </text>
                              </svg>
                            `
                          }
                        }}
                      />
                    </div>
                    {fromToken.symbol}
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
              onClick={handleSwitch}
              className="h-9 w-9 rounded-full bg-[#0d1117] border-4 border-[#161b22] flex items-center justify-center hover:bg-[#1c2128] transition-all active:scale-90 group shadow-lg"
            >
              <ArrowDown className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors group-hover:rotate-180 duration-300" />
            </button>
          </div>

          {/* Buy Card */}
          <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Buy</span>
              {toToken && (
                <span className="flex items-center gap-1 text-sm font-medium text-white/70">
                  <Wallet size={14} /> {formattedToBalance}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <AmountInput
                  value={toToken ? buyDisplayValue : null}
                  onChange={(value) => {
                    setEditingSide("buy")
                    setAmount(value)
                  }}
                  onFocus={() => setEditingSide("buy")}
                  onBlur={() => {}}
                  isActive={editingSide === "buy"}
                  isDisabled={!toToken}
                  showError={false}
                  isQuoteLoading={effectiveQuoteLoading}
                  inputRef={buyInputRef}
                />
                <TokenInfoRow
                  displayAmount={outputAmount || "0"}
                  tokenPrice={activeToTokenPrice}
                  isLoadingPrice={isLoadingToPrice}
                  token={toToken}
                  balance={toBalance}
                  balanceValue={toBalanceValue}
                  formattedBalance={formattedToBalance}
                  isLoadingBalance={isLoadingToBalance}
                  isConnected={isConnected}
                  address={address}
                  showError={false}
                  side="buy"
                />
              </div>
              <button
                onClick={() => setIsToTokenSelectorOpen(true)}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0",
                  toToken
                    ? "bg-white/10 hover:bg-white/15 text-white"
                    : "bg-primary hover:bg-primary/90 text-white"
                )}
              >
                {toToken ? (
                  <>
                    <div className="h-6 w-6">
                      <img
                        src={toToken.logoURI}
                        alt={toToken.symbol}
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
                                  ${toToken.symbol.charAt(0)}
                                </text>
                              </svg>
                            `
                          }
                        }}
                      />
                    </div>
                    {toToken.symbol}
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
        {/* Exchange Rate Info - Below both cards */}
        {fromToken && toToken && (
          <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl bg-white/5 border border-white/5 px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {/* Left Side: Rate and Live Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400">{exchangeRateContent}</span>

                {activeQuote && !isWrapUnwrap && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-colors duration-500",
                        isManualInversion ? "bg-yellow-500 animate-pulse" : "bg-primary"
                      )}
                    />
                    <span className="text-[10px] tabular-nums opacity-70">{timeLeft}s</span>
                  </div>
                )}
              </div>

              {/* Right Side: Price Impact (Hidden for Wrap/Unwrap) */}
              {!isWrapUnwrap && (
                <span
                  className={cn(
                    "flex items-center gap-1 font-medium",
                    getPriceImpactSeverity(activeQuote?.priceImpact || 0) === "low" &&
                      "text-green-400",
                    getPriceImpactSeverity(activeQuote?.priceImpact || 0) === "medium" &&
                      "text-yellow-400",
                    getPriceImpactSeverity(activeQuote?.priceImpact || 0) === "high" &&
                      "text-red-400"
                  )}
                >
                  <span className="text-gray-400 font-normal">Impact:</span>
                  {activeQuote ? formatPriceImpact(activeQuote.priceImpact) : "-"}

                  {getPriceImpactSeverity(activeQuote?.priceImpact || 0) === "high" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 cursor-help ml-0.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-popover border-border">
                          <p className="text-xs">
                            High price impact - trade may result in significant slippage
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </span>
              )}
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
          ) : !toToken ? (
            <Button
              disabled
              className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-not-allowed"
            >
              Select a token
            </Button>
          ) : !amount ? (
            <Button
              disabled
              className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-not-allowed"
            >
              Enter an amount
            </Button>
          ) : insufficientBalance ? (
            <Button
              disabled
              className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-red-500/20 text-red-400 cursor-not-allowed border border-red-500/30"
            >
              Insufficient Balance
            </Button>
          ) : (
            <Button
              onClick={handleSwapClick}
              className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-gradient-to-r from-pink-500 to-primary hover:opacity-90 transition-all active:scale-[0.98]"
            >
              {isWrap ? "Wrap" : isUnwrap ? "Unwrap" : "Swap"}
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
      {fromToken && toToken && (
        <SwapReviewModal
          open={isConfirmationOpen}
          onOpenChange={setIsConfirmationOpen}
          fromToken={fromToken.symbol}
          toToken={toToken.symbol}
          fromAmount={amount}
          toAmount={isWrapUnwrap ? amount : activeQuote?.amountOutFormatted || "0"}
          fromUsdValue={
            activeFromTokenPrice
              ? `$${(parseFloat(amount || "0") * activeFromTokenPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "$0.00"
          }
          toUsdValue={
            activeToTokenPrice
              ? `$${(parseFloat(outputAmount || "0") * activeToTokenPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "$0.00"
          }
          exchangeRate={isWrapUnwrap ? 1 : activeQuote?.exchangeRate || 0}
          onConfirm={handleConfirmSwap}
          isSwapping={isWrapUnwrap ? isWrapUnwrapPending || isWrapUnwrapConfirming : false}
          minOut={isWrapUnwrap ? amount : activeQuote?.minOutFormatted || "0"}
          priceImpact={isWrapUnwrap ? 0 : activeQuote?.priceImpact || 0}
          slippage={effectiveSlippage}
        />
      )}

      {/* Token Selector Modals */}
      <TokenSelectorModal
        open={isFromTokenSelectorOpen}
        onOpenChange={setIsFromTokenSelectorOpen}
        onSelectToken={(tokenSymbol) => {
          const token = tokens.find((t) => t.symbol === tokenSymbol)
          if (token) {
            handleFromTokenSelect(token)
          }
        }}
        selectedToken={fromToken?.symbol}
        excludeToken={toToken?.symbol}
        customTokens={{}}
        onAddCustomToken={() => {}}
      />
      <TokenSelectorModal
        open={isToTokenSelectorOpen}
        onOpenChange={setIsToTokenSelectorOpen}
        onSelectToken={(tokenSymbol) => {
          const token = tokens.find((t) => t.symbol === tokenSymbol)
          if (token) {
            handleToTokenSelect(token)
          }
        }}
        selectedToken={toToken?.symbol}
        excludeToken={fromToken?.symbol}
        customTokens={{}}
        onAddCustomToken={() => {}}
      />
    </div>
  )
}
