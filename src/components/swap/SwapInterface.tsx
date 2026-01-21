"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { ArrowDown, Wallet } from "lucide-react"
import { useAccount, useBalance } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { formatUnits } from "viem"
import { cn, formatCurrency } from "@/lib/utils"
import TokenSelector from "./TokenSelector"
import TokenSelectButton from "./TokenSelectButton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useQuote, formatQuoteAmount } from "@/hooks/use-quote"
import tokenList from "@/lib/token-list.json"
import type { Token } from "@/types/swap"
import NumberFlow from "@number-flow/react"

interface SwapInterfaceProps {
  onGetStarted?: () => void
}

// Stablecoin symbols (2 decimals)
const STABLECOIN_SYMBOLS = ["USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX", "USDP", "LUSD"]

// Major asset symbols (4-6 decimals)
const MAJOR_ASSET_SYMBOLS = ["ETH", "WBTC", "BTC"]

/**
 * Smart formatter for display amounts
 * Handles different token types with appropriate decimal precision
 */
const formatDisplayAmount = (amount: string | number, token?: Token): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount

  if (isNaN(num) || num === 0) return "0"

  const symbol = token?.symbol?.toUpperCase() || ""

  // Stablecoins: 2 decimals
  if (STABLECOIN_SYMBOLS.includes(symbol)) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num)
  }

  // Very small numbers (< 0.001): use significant digits
  if (num < 0.001) {
    return num.toLocaleString("en-US", {
      maximumSignificantDigits: 6,
      notation: "standard",
    })
  }

  // Major assets: 4-6 decimals based on value
  if (MAJOR_ASSET_SYMBOLS.includes(symbol)) {
    // For values >= 1, show 4 decimals. For < 1, show 6 decimals
    const decimals = num >= 1 ? 4 : 6
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    }).format(num)
  }

  // Default: 4-6 decimals based on value
  const decimals = num >= 1 ? 4 : 6
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(num)
}

/**
 * Formats amount with visual contrast (graying trailing digits)
 */
const formatAmountWithContrast = (amount: string, token?: Token): React.ReactNode => {
  const formatted = formatDisplayAmount(amount, token)
  const num = parseFloat(amount)

  if (isNaN(num) || num === 0) return "0"

  // For very precise numbers, show trailing digits in gray
  const fullStr = num.toString()
  const formattedStr = formatted.replace(/,/g, "")

  // If the formatted string is shorter, show trailing digits in gray
  if (fullStr.length > formattedStr.length && num < 1) {
    const matchIndex = formattedStr.length
    const significantPart = formattedStr
    const trailingPart = fullStr.substring(matchIndex)

    // Only show gray if there are meaningful trailing digits
    if (trailingPart.length > 0 && trailingPart !== "0") {
      return (
        <>
          {significantPart}
          <span className="text-white/20">{trailingPart.substring(0, 4)}</span>
        </>
      )
    }
  }

  return formatted
}

// Default ETH token for when wallet is not connected
const DEFAULT_ETH_TOKEN: Token = {
  address: "0x0000000000000000000000000000000000000000",
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
  logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
}

export default function SwapInterface({ onGetStarted }: SwapInterfaceProps = {}) {
  const { isConnected, address } = useAccount()
  const { openConnectModal } = useConnectModal()

  // Use token list from JSON file
  const tokens = tokenList as Token[]

  const [amount, setAmount] = useState("")
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [fromToken, setFromToken] = useState<Token | undefined>(DEFAULT_ETH_TOKEN)
  const [toToken, setToToken] = useState<Token | undefined>(undefined)

  // Wrapper functions to trigger immediate quote refetch when tokens change
  const handleFromTokenSelect = (token: Token | undefined) => {
    setFromToken(token)
    // Force immediate quote refetch when token is selected (bypass debounce)
    setTimeout(() => {
      refetch()
    }, 0)
  }

  const handleToTokenSelect = (token: Token | undefined) => {
    setToToken(token)
    // Force immediate quote refetch when token is selected (bypass debounce)
    setTimeout(() => {
      refetch()
    }, 0)
  }
  const [isFromTokenSelectorOpen, setIsFromTokenSelectorOpen] = useState(false)
  const [isToTokenSelectorOpen, setIsToTokenSelectorOpen] = useState(false)
  const [fromTokenPrice, setFromTokenPrice] = useState<number | null>(null)
  const [toTokenPrice, setToTokenPrice] = useState<number | null>(null)
  const [isLoadingFromPrice, setIsLoadingFromPrice] = useState(false)
  const [isLoadingToPrice, setIsLoadingToPrice] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15) // Quote expiration timer
  const [displayQuote, setDisplayQuote] = useState<string | null>(null)
  const [pendingQuote, setPendingQuote] = useState<string | null>(null) // Quote waiting to be displayed after pulse
  const hasRefetchedRef = useRef(false)
  const [pulseKey, setPulseKey] = useState(0) // Key to trigger animation
  const [pulseAnimationKey, setPulseAnimationKey] = useState(0) // Key to force animation restart
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastQuoteAmountRef = useRef<string | null>(null) // Track last quote amount to detect changes
  const quoteTimestampRef = useRef<number>(0) // Track when quote was last updated
  const isSwitchingRef = useRef(false) // Track if we're currently switching to prevent hook from triggering
  const sellInputRef = useRef<HTMLInputElement>(null) // Ref for sell input to focus on load
  const [insufficientBalance, setInsufficientBalance] = useState(false) // Track if amount exceeds balance
  const [editingSide, setEditingSide] = useState<"sell" | "buy">("sell") // Track which side is being edited

  // Use new quote hook to calculate output amount
  // When editing sell: exactIn (fromToken -> toToken)
  // Fixed: tokenIn is ALWAYS fromToken, tokenOut is ALWAYS toToken
  // Only tradeType changes based on which box the user is typing in
  // This prevents decimal normalization issues
  const {
    quote,
    isLoading: isQuoteLoading,
    refetch,
  } = useQuote({
    // tokenIn is ALWAYS the "From" token (Top Box/Sell)
    tokenIn: fromToken?.symbol || "",
    // tokenOut is ALWAYS the "To" token (Bottom Box/Buy)
    tokenOut: toToken?.symbol || "",
    // This is the value from the box you are currently typing in
    amountIn: amount,
    slippage: "0.5",
    debounceMs: 100, // Lower debounce for real-time updates as user types
    // This tells the engine which box 'amount' refers to
    tradeType: editingSide === "sell" ? "exactIn" : "exactOut",
    enabled:
      !isSwitchingRef.current && // Prevent hook from triggering during switch
      !!amount &&
      parseFloat(amount) > 0 &&
      !!fromToken &&
      !!toToken &&
      !!fromToken?.symbol &&
      !!toToken?.symbol,
  })

  // Always update displayQuote when we get a quote
  // Force update to show latest value even if it appears the same
  // For exactIn (sell side): show amountOut in buy side
  // For exactOut (buy side): show amountIn in sell side
  useEffect(() => {
    // Don't clear displayQuote during switch - preserve manually set values
    if (isSwitchingRef.current) {
      return
    }

    if (!quote) {
      setDisplayQuote(null)
      setPendingQuote(null)
      lastQuoteAmountRef.current = null
      return
    }

    const quoteValue = editingSide === "sell" ? quote.amountOutFormatted : quote.amountInFormatted

    if (quoteValue) {
      // Check if it's a new quote
      const quoteId =
        editingSide === "sell" ? quote.amountOut.toString() : quote.amountIn.toString()
      const isNewQuote = quoteId !== lastQuoteAmountRef.current

      if (isNewQuote) {
        // If currently loading/pulsing, store as pending and wait for pulse to complete
        if (isQuoteLoading) {
          setPendingQuote(quoteValue)
        } else {
          // Not loading, update immediately
          setDisplayQuote(quoteValue)
          setPendingQuote(null)
        }

        if (isNewQuote) {
          lastQuoteAmountRef.current = quoteId
          setTimeLeft(15) // Reset timer when new quote arrives
          hasRefetchedRef.current = false
        }
      }
    } else {
      setDisplayQuote(null)
      setPendingQuote(null)
      lastQuoteAmountRef.current = null
    }
  }, [quote, editingSide, isQuoteLoading]) // Depend on entire quote object to catch all changes

  // Clear displayQuote when inputs are invalid
  useEffect(() => {
    // Don't clear displayQuote during switch - preserve manually set values
    if (isSwitchingRef.current) {
      return
    }

    if (!amount || parseFloat(amount) <= 0 || !fromToken || !toToken) {
      setDisplayQuote(null)
      lastQuoteAmountRef.current = null
      hasRefetchedRef.current = false
    }
  }, [amount, fromToken, toToken])

  // Handle countdown timer and auto-refetch
  useEffect(() => {
    if (!displayQuote) {
      setTimeLeft(15)
      hasRefetchedRef.current = false
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1

        // Refetch when we hit 3 seconds (first pulse) - trigger every cycle
        if (newTime === 3) {
          hasRefetchedRef.current = true
          setPulseKey((k) => k + 1) // Trigger pulse animation
          // Force refetch to get latest market price
          setTimeout(() => {
            refetch()
          }, 0)
        }

        if (newTime <= 0) {
          // Reset and continue the cycle - allow pulsing again next cycle
          hasRefetchedRef.current = false
          setPulseKey(0) // Reset pulse key for next cycle
          refetch() // Also refetch when timer resets
          return 15
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [displayQuote, refetch, quote])

  // Output amount from quote (use displayQuote to prevent blank state)
  // For exactIn: show amountOut in opposite side
  // For exactOut: show amountIn in opposite side
  const outputAmount =
    displayQuote ||
    (editingSide === "sell" ? quote?.amountOutFormatted || "0" : quote?.amountInFormatted || "0") ||
    "0"
  // Pulse when loading quotes (infinite loop) or when pulseKey > 0 (single cycle for timer-based refetch)
  const shouldPulse = (isQuoteLoading || pulseKey > 0) && displayQuote !== null
  const shouldPulseLoop = isQuoteLoading && displayQuote !== null // Infinite loop while loading

  // Track when loading starts to calculate when to update quote at final pulse
  const loadingStartTimeRef = useRef<number | null>(null)

  // Track loading state changes and restart pulse animation when loading starts
  useEffect(() => {
    if (isQuoteLoading && displayQuote !== null) {
      loadingStartTimeRef.current = Date.now()
      // Force animation restart by updating the key
      setPulseAnimationKey((prev) => prev + 1)
    }
  }, [isQuoteLoading, displayQuote])

  // Apply pending quote when loading completes (at the final pulse of current cycle)
  useEffect(() => {
    if (!isQuoteLoading && pendingQuote) {
      // Clear any existing timeout
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current)
      }

      // Calculate how long we've been loading to determine position in pulse cycle
      const loadingDuration = loadingStartTimeRef.current
        ? Date.now() - loadingStartTimeRef.current
        : 0

      // Pulse cycle is 6 seconds, final pulse starts at 48% = 2.88s
      // We want to update the quote when the pulse reaches the final pulse (48% mark)
      const timeInCurrentCycle = loadingDuration % 6000
      let waitTime = 0

      if (timeInCurrentCycle < 2880) {
        // We're before the final pulse, wait until we reach it (48% = 2.88s)
        waitTime = 2880 - timeInCurrentCycle
      } else {
        // We're past the final pulse in current cycle, wait for next cycle to reach it
        waitTime = 6000 - timeInCurrentCycle + 2880
      }

      // Ensure minimum wait time for smooth transition (at least 100ms)
      waitTime = Math.max(waitTime, 100)

      pulseTimeoutRef.current = setTimeout(() => {
        setDisplayQuote(pendingQuote)
        setPendingQuote(null)
        setPulseKey(0) // Reset pulse key
        loadingStartTimeRef.current = null
      }, waitTime)
    }

    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current)
      }
    }
  }, [isQuoteLoading, pendingQuote])

  // Track if user has explicitly set fromToken to undefined (for "Select token" state)
  const [hasExplicitlyClearedFromToken, setHasExplicitlyClearedFromToken] = useState(false)
  const [hasExplicitlyClearedToToken, setHasExplicitlyClearedToToken] = useState(false)

  // Reset flags when tokens are selected
  useEffect(() => {
    if (fromToken) {
      setHasExplicitlyClearedFromToken(false)
    }
  }, [fromToken])

  useEffect(() => {
    if (toToken) {
      setHasExplicitlyClearedToToken(false)
    }
  }, [toToken])

  // Default to ETH when wallet is not connected or when tokens load
  useEffect(() => {
    // Don't auto-set if user has explicitly cleared the token (for "Select token" state)
    if (hasExplicitlyClearedFromToken) return

    if (!isConnected) {
      // When wallet is not connected, always default to ETH
      const ethToken = tokens.find((t) => t.symbol === "ETH") || DEFAULT_ETH_TOKEN
      setFromToken(ethToken)
    } else if (tokens.length > 0 && !fromToken) {
      // When wallet connects and tokens are loaded, default to ETH if no token selected
      const ethToken = tokens.find((t) => t.symbol === "ETH") || DEFAULT_ETH_TOKEN
      setFromToken(ethToken)
    }
  }, [isConnected, tokens, fromToken, hasExplicitlyClearedFromToken])

  // Fetch token price when fromToken changes
  useEffect(() => {
    if (!fromToken?.symbol) {
      setFromTokenPrice(null)
      return
    }

    setIsLoadingFromPrice(true)
    fetch(`/api/token-price?symbol=${encodeURIComponent(fromToken.symbol)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.price) {
          setFromTokenPrice(data.price)
        } else {
          setFromTokenPrice(null)
        }
      })
      .catch((error) => {
        console.error("Error fetching fromToken price:", error)
        setFromTokenPrice(null)
      })
      .finally(() => {
        setIsLoadingFromPrice(false)
      })
  }, [fromToken])

  // Fetch token price when toToken changes
  useEffect(() => {
    if (!toToken?.symbol) {
      setToTokenPrice(null)
      return
    }

    setIsLoadingToPrice(true)
    fetch(`/api/token-price?symbol=${encodeURIComponent(toToken.symbol)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.price) {
          setToTokenPrice(data.price)
        } else {
          setToTokenPrice(null)
        }
      })
      .catch((error) => {
        console.error("Error fetching toToken price:", error)
        setToTokenPrice(null)
      })
      .finally(() => {
        setIsLoadingToPrice(false)
      })
  }, [toToken])

  // Fetch balance for fromToken (native ETH or ERC20)
  const { data: fromBalance, isLoading: isLoadingFromBalance } = useBalance({
    address: isConnected && address ? address : undefined,
    token:
      fromToken?.address && fromToken.address !== "0x0000000000000000000000000000000000000000"
        ? (fromToken.address as `0x${string}`)
        : undefined,
    query: {
      enabled: isConnected && !!address && !!fromToken,
    },
  })

  // Fetch balance for toToken (native ETH or ERC20)
  const { data: toBalance, isLoading: isLoadingToBalance } = useBalance({
    address: isConnected && address ? address : undefined,
    token:
      toToken?.address && toToken.address !== "0x0000000000000000000000000000000000000000"
        ? (toToken.address as `0x${string}`)
        : undefined,
    query: {
      enabled: isConnected && !!address && !!toToken,
    },
  })

  // Format balances for display using smart formatter
  const fromBalanceValue =
    fromBalance && fromToken ? parseFloat(formatUnits(fromBalance.value, fromToken.decimals)) : 0
  const formattedFromBalance =
    fromBalanceValue > 0 ? formatDisplayAmount(fromBalanceValue, fromToken) : "0"

  const toBalanceValue =
    toBalance && toToken ? parseFloat(formatUnits(toBalance.value, toToken.decimals)) : 0
  const formattedToBalance = toBalanceValue > 0 ? formatDisplayAmount(toBalanceValue, toToken) : "0"

  // Validate sell quantity against wallet balance
  // When sell side is active: fromToken is being sold (validate input amount against fromBalance)
  // When buy side is active: toToken is being sold (validate input amount against toBalance)
  // Also validate when quote is updated (displayQuote changes) to catch cases where quote calculation
  // results in a sell amount that exceeds balance
  useEffect(() => {
    // Always clear error if not connected
    if (!isConnected) {
      setInsufficientBalance(false)
      return
    }

    // Always clear error if amount is empty, zero, or invalid
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

    // Validate against the token being sold based on which side is being edited
    if (editingSide === "sell") {
      // Editing sell side: validate against fromToken balance
      if (!fromToken || !fromBalance) {
        setInsufficientBalance(false)
        return
      }
      const exceedsBalance = amountValue > fromBalanceValue + 0.0000001
      setInsufficientBalance(exceedsBalance)
    } else {
      // Editing buy side: validate against toToken balance (we're selling toToken to buy fromToken)
      if (!toToken || !toBalance) {
        setInsufficientBalance(false)
        return
      }
      const exceedsBalance = amountValue > toBalanceValue + 0.0000001
      setInsufficientBalance(exceedsBalance)
    }
  }, [
    amount,
    fromBalance,
    toBalance,
    fromToken,
    toToken,
    editingSide,
    isConnected,
    fromBalanceValue,
    toBalanceValue,
    displayQuote,
  ])

  // Focus sell input on component mount
  useEffect(() => {
    if (sellInputRef.current) {
      // Small delay to ensure component is fully rendered
      const timer = setTimeout(() => {
        sellInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [])

  // Common tokens for quick select: ETH, USDC, USDT, WBTC, WETH
  const commonTokens = useMemo(() => {
    const symbols = ["ETH", "USDC", "USDT", "WBTC", "WETH"]
    const foundTokens: Token[] = []

    // Always start with ETH (DEFAULT_ETH_TOKEN) if it's not the from token
    if (!fromToken || fromToken.symbol.toUpperCase() !== "ETH") {
      const ethToken = tokens.find((t) => t.symbol.toUpperCase() === "ETH") || DEFAULT_ETH_TOKEN
      foundTokens.push(ethToken)
    }

    // Add other tokens in order
    symbols.forEach((symbol) => {
      if (symbol.toUpperCase() === "ETH") return // Already added above

      const token = tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase())

      // Only add if token exists and is not the from token
      if (token && token.address !== fromToken?.address) {
        foundTokens.push(token)
      }
    })

    return foundTokens
  }, [tokens, fromToken])

  return (
    <div className="w-full max-w-[500px] bg-[#131313] border border-white/10 rounded-[24px] p-2 flex flex-col gap-1 shadow-2xl relative z-0">
      {/* SELL SECTION */}
      <div
        className={cn(
          "group rounded-[20px] p-4 flex flex-col gap-2 transition-all cursor-pointer",
          editingSide === "sell" ? "bg-[#222] shadow-2xl" : "bg-[#1B1B1B]/50"
        )}
        onClick={() => {
          setEditingSide("sell")
          setIsInputFocused(true)
        }}
      >
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Sell
          </span>
          {/* Quick Select Percentages - Always rendered to prevent layout shift */}
          <div
            className={cn(
              "flex gap-1 transition-opacity duration-200",
              isConnected && fromBalance && fromToken
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-0 pointer-events-none"
            )}
          >
            {["25%", "50%", "75%", "Max"].map((pct) => {
              const handlePercentageClick = () => {
                if (!fromBalance || !fromToken) return

                const balanceValue = parseFloat(formatUnits(fromBalance.value, fromToken.decimals))

                if (pct === "Max") {
                  setAmount(balanceValue.toString())
                } else {
                  const percent = parseFloat(pct) / 100
                  const amountValue = balanceValue * percent
                  setAmount(amountValue.toString())
                }
              }

              return (
                <button
                  key={pct}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePercentageClick()
                  }}
                  className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-bold text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                >
                  {pct}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
          {/* Always show input - editable when editingSide === "sell", shows quote when editingSide === "buy" */}
          {(() => {
            const isActive = editingSide === "sell"
            // Strict Lead-Follow Pattern:
            // If editing SELL: This is the MASTER (shows raw state)
            // If editing BUY: This is the FOLLOWER (shows the quote)
            // Prioritize displayQuote (manually set during switch) over hook quote
            const displayValue = isActive ? amount : displayQuote || quote?.amountInFormatted || "0"
            const fullValue =
              amount && parseFloat(amount) > 0 ? parseFloat(amount).toString() : null
            const isTrimmed = isActive && fullValue && displayValue !== fullValue

            if (isTrimmed) {
              return (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1 relative">
                        {isActive ? (
                          <input
                            ref={sellInputRef}
                            key={`sell-input-${pulseAnimationKey}`}
                            type="text"
                            value={displayValue}
                            onChange={(e) => {
                              // Force direction to sell when typing in sell input
                              setEditingSide("sell")
                              // Allow user to type freely, store raw value
                              const value = e.target.value.replace(/[^0-9.]/g, "")
                              // Prevent multiple decimal points
                              const parts = value.split(".")
                              const cleaned =
                                parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value
                              setAmount(cleaned)
                            }}
                            onFocus={() => {
                              setIsInputFocused(true)
                              setEditingSide("sell")
                            }}
                            onBlur={() => {
                              setIsInputFocused(false)
                              // Format on blur if needed
                              if (amount) {
                                const num = parseFloat(amount)
                                if (!isNaN(num)) {
                                  setAmount(num.toString())
                                }
                              }
                            }}
                            placeholder="0"
                            className={cn(
                              "bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none cursor-text caret-white",
                              insufficientBalance && isActive && "text-destructive"
                            )}
                            disabled={!isConnected}
                          />
                        ) : (
                          <div
                            className={cn(
                              "text-4xl font-medium leading-none cursor-text",
                              !isActive && isQuoteLoading && "animate-pulse-3-loop"
                            )}
                          >
                            <NumberFlow
                              value={parseFloat(displayValue) || 0}
                              format={{ minimumFractionDigits: 0, maximumFractionDigits: 6 }}
                              spinTiming={{ duration: 600, easing: "ease-out" }}
                            />
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="text-xs font-mono bg-zinc-900 border-zinc-700"
                    >
                      <p className="text-white/70">
                        {parseFloat(amount).toLocaleString("en-US", {
                          maximumFractionDigits: 18,
                          useGrouping: false,
                        })}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }

            return (
              <div className="flex-1 relative">
                <input
                  ref={sellInputRef}
                  key={`sell-input-simple-${pulseAnimationKey}`}
                  type="text"
                  value={displayValue}
                  onChange={(e) => {
                    // Force direction to sell when typing in sell input
                    setEditingSide("sell")
                    // Allow user to type freely, store raw value
                    const value = e.target.value.replace(/[^0-9.]/g, "")
                    // Prevent multiple decimal points
                    const parts = value.split(".")
                    const cleaned =
                      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value
                    setAmount(cleaned)
                  }}
                  onFocus={() => {
                    setIsInputFocused(true)
                    setEditingSide("sell")
                  }}
                  onBlur={() => {
                    setIsInputFocused(false)
                    // Format on blur if needed
                    if (amount) {
                      const num = parseFloat(amount)
                      if (!isNaN(num)) {
                        setAmount(num.toString())
                      }
                    }
                  }}
                  placeholder="0"
                  className={cn(
                    "bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none cursor-text caret-white",
                    insufficientBalance && isActive && "text-destructive",
                    !isActive && shouldPulseLoop && "animate-pulse-3-loop",
                    !isActive && shouldPulse && !shouldPulseLoop && "animate-pulse-3"
                  )}
                  disabled={!isConnected}
                />
              </div>
            )
          })()}
          <TokenSelectButton
            token={fromToken}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsFromTokenSelectorOpen(true)
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
            <span>
              {(() => {
                const displayAmount = editingSide === "sell" ? amount : outputAmount
                return displayAmount && parseFloat(displayAmount) > 0 && fromTokenPrice
                  ? (() => {
                      const usdValue = parseFloat(displayAmount) * fromTokenPrice
                      return `$${usdValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        useGrouping: true,
                      })}`
                    })()
                  : displayAmount && parseFloat(displayAmount) > 0 && isLoadingFromPrice
                    ? "—"
                    : "—"
              })()}
            </span>
            {isConnected && address && fromToken && fromBalance && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      <Wallet size={12} className="opacity-40" />
                      <span
                        className={cn(
                          editingSide === "sell" && insufficientBalance && "text-destructive"
                        )}
                      >
                        {isLoadingFromBalance ? "—" : `${formattedFromBalance} ${fromToken.symbol}`}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="text-xs font-mono bg-zinc-900 border-zinc-700"
                  >
                    <p className="text-white/90">Full balance:</p>
                    <p className="text-white/70">
                      {fromBalanceValue.toLocaleString("en-US", {
                        maximumFractionDigits: 18,
                        useGrouping: false,
                      })}{" "}
                      {fromToken.symbol}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* SWITCH BUTTON (Centered) */}
      <div className="relative h-2 w-full flex justify-center z-20">
        <button
          onClick={() => {
            // 1. Set switching flag
            isSwitchingRef.current = true

            // Clear error state immediately on switch
            setInsufficientBalance(false)

            // Clear pulse state to stop any ongoing animations
            setPulseKey(0)
            setPulseAnimationKey(0)
            if (pulseTimeoutRef.current) {
              clearTimeout(pulseTimeoutRef.current)
              pulseTimeoutRef.current = null
            }

            // 2. Capture the exact values currently visible in the UI
            // If I'm selling 1 ETH for 2500 USDC:
            // sellValue = "1" (what's in sell box), buyValue = "2500" (what's in buy box)
            // Always capture from displayQuote if available (it's the source of truth for follower boxes)
            const currentSellValue =
              editingSide === "sell" ? amount : displayQuote || quote?.amountInFormatted || ""
            const currentBuyValue =
              editingSide === "buy" ? amount : displayQuote || quote?.amountOutFormatted || ""

            // 3. Store tokens to swap
            const tempFromToken = fromToken
            const tempToToken = toToken

            // 4. Swap Tokens
            setFromToken(tempToToken)
            setToToken(tempFromToken)

            // If swapping undefined tokens, preserve the "Select token" state
            if (tempToToken === undefined) {
              setHasExplicitlyClearedFromToken(true)
            } else {
              setHasExplicitlyClearedFromToken(false)
            }

            if (tempFromToken === undefined) {
              setHasExplicitlyClearedToToken(true)
            } else {
              setHasExplicitlyClearedToToken(false)
            }

            // 5. Flip Direction and Values Optimistically
            // IMPORTANT: Update state in correct order to prevent flicker
            if (editingSide === "sell") {
              // We were editing the top (sell), now we edit the bottom (buy).
              // The "1" (sellValue = amount) moves to the bottom and becomes the new buy input.
              // The "2500" (buyValue = displayQuote) moves to the top and becomes the new sell display.
              // Order: Set displayQuote first, then amount, then editingSide
              setDisplayQuote(currentBuyValue || "")
              setAmount(currentSellValue || "")
              setEditingSide("buy")
            } else {
              // We were editing the bottom (buy), now we edit the top (sell).
              // The "2500" (buyValue = amount) moves to the top and becomes the new sell input.
              // The "1" (sellValue = displayQuote) moves to the bottom and becomes the new buy display.
              setDisplayQuote(currentSellValue || "")
              setAmount(currentBuyValue || "")
              setEditingSide("sell")
            }

            // 6. Reset switching flag after a short delay to allow the hook to "see" the new state
            setTimeout(() => {
              isSwitchingRef.current = false
            }, 100)

            // Clear pending quote to prevent stale updates, but keep displayQuote for instant feedback
            setPendingQuote(null)
            lastQuoteAmountRef.current = null

            // Swap prices
            const tempFromPrice = fromTokenPrice
            const tempToPrice = toTokenPrice
            setFromTokenPrice(tempToPrice)
            setToTokenPrice(tempFromPrice)
          }}
          className="absolute -top-4 p-2 bg-[#1B1B1B] border-[4px] border-[#131313] rounded-xl hover:scale-110 transition-transform text-white shadow-lg"
        >
          <ArrowDown size={18} strokeWidth={3} />
        </button>
      </div>

      {/* BUY SECTION */}
      <div
        className={cn(
          "group relative rounded-[20px] p-4 flex flex-col gap-2 transition-all cursor-pointer",
          editingSide === "buy" ? "bg-[#222] shadow-2xl" : "bg-[#1B1B1B]/50"
        )}
        onClick={() => {
          setEditingSide("buy")
          setIsInputFocused(true)
        }}
      >
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Buy
          </span>
          {/* Common Tokens Quick Select - Always rendered to prevent layout shift */}
          <TooltipProvider delayDuration={0}>
            <div
              className={cn(
                "flex gap-1.5 transition-opacity duration-200",
                commonTokens.length > 0
                  ? "opacity-0 group-hover:opacity-100"
                  : "opacity-0 pointer-events-none"
              )}
            >
              {commonTokens.map((token) => (
                <Tooltip key={token.address}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToTokenSelect(token)
                      }}
                      className="p-1 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                    >
                      {token.logoURI ? (
                        <img
                          src={token.logoURI}
                          alt={token.symbol}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                          <span className="text-[10px] font-bold">{token.symbol[0]}</span>
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{token.symbol}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>

        <div className="flex justify-between items-center mt-1">
          {/* Always show input - editable when editingSide === "buy", shows quote when editingSide === "sell" */}
          {(() => {
            const isActive = editingSide === "buy"
            // Strict Lead-Follow Pattern:
            // If editing BUY: This is the MASTER (shows raw state)
            // If editing SELL: This is the FOLLOWER (shows the quote)
            // Prioritize displayQuote (manually set during switch) over hook quote
            const displayValue = isActive
              ? amount
              : displayQuote || quote?.amountOutFormatted || "0"
            const fullValue =
              amount && parseFloat(amount) > 0 ? parseFloat(amount).toString() : null
            const isTrimmed = isActive && fullValue && displayValue !== fullValue

            if (isTrimmed) {
              return (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1 relative">
                        {isActive ? (
                          <input
                            key={`buy-input-tooltip-${pulseAnimationKey}`}
                            type="text"
                            value={displayValue}
                            onChange={(e) => {
                              // Force direction to buy when typing in buy input
                              setEditingSide("buy")
                              // Allow user to type freely, store raw value
                              const value = e.target.value.replace(/[^0-9.]/g, "")
                              // Prevent multiple decimal points
                              const parts = value.split(".")
                              const cleaned =
                                parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value
                              setAmount(cleaned)
                            }}
                            onFocus={() => {
                              setIsInputFocused(true)
                              setEditingSide("buy")
                            }}
                            onBlur={() => {
                              setIsInputFocused(false)
                              // Format on blur if needed
                              if (amount) {
                                const num = parseFloat(amount)
                                if (!isNaN(num)) {
                                  setAmount(num.toString())
                                }
                              }
                            }}
                            placeholder="0"
                            className="bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none cursor-text caret-white"
                            disabled={!isConnected}
                          />
                        ) : (
                          <div
                            className={cn(
                              "text-4xl font-medium leading-none cursor-text",
                              !isActive && isQuoteLoading && "animate-pulse-3-loop"
                            )}
                          >
                            <NumberFlow
                              value={parseFloat(displayValue) || 0}
                              format={{ minimumFractionDigits: 0, maximumFractionDigits: 6 }}
                              spinTiming={{ duration: 600, easing: "ease-out" }}
                            />
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="text-xs font-mono bg-zinc-900 border-zinc-700"
                    >
                      <p className="text-white/70">
                        {parseFloat(amount).toLocaleString("en-US", {
                          maximumFractionDigits: 18,
                          useGrouping: false,
                        })}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }

            return (
              <div className="flex-1 relative">
                {isActive ? (
                  <input
                    key={`buy-input-simple-${pulseAnimationKey}`}
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                      // Force direction to buy when typing in buy input
                      setEditingSide("buy")
                      // Allow user to type freely, store raw value
                      const value = e.target.value.replace(/[^0-9.]/g, "")
                      // Prevent multiple decimal points
                      const parts = value.split(".")
                      const cleaned =
                        parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value
                      setAmount(cleaned)
                    }}
                    onFocus={() => {
                      setIsInputFocused(true)
                      setEditingSide("buy")
                    }}
                    onBlur={() => {
                      setIsInputFocused(false)
                      // Format on blur if needed
                      if (amount) {
                        const num = parseFloat(amount)
                        if (!isNaN(num)) {
                          setAmount(num.toString())
                        }
                      }
                    }}
                    placeholder="0"
                    className="bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none cursor-text caret-white"
                    disabled={!isConnected}
                  />
                ) : (
                  <div
                    className={cn(
                      "text-4xl font-medium leading-none cursor-text",
                      !isActive && shouldPulseLoop && "animate-pulse-3-loop",
                      !isActive && shouldPulse && !shouldPulseLoop && "animate-pulse-3"
                    )}
                  >
                    <NumberFlow
                      value={parseFloat(displayValue) || 0}
                      format={{ minimumFractionDigits: 0, maximumFractionDigits: 6 }}
                      spinTiming={{ duration: 600, easing: "ease-out" }}
                    />
                  </div>
                )}
              </div>
            )
          })()}
          <TokenSelectButton
            token={toToken}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsToTokenSelectorOpen(true)
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
            <span>
              {(() => {
                const displayAmount = editingSide === "buy" ? amount : outputAmount
                return displayAmount && parseFloat(displayAmount) > 0 && toTokenPrice
                  ? (() => {
                      const usdValue = parseFloat(displayAmount) * toTokenPrice
                      return `$${usdValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        useGrouping: true,
                      })}`
                    })()
                  : displayAmount && parseFloat(displayAmount) > 0 && isLoadingToPrice
                    ? "—"
                    : "—"
              })()}
            </span>
            {isConnected && address && toToken && toBalance && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      <Wallet size={12} className="opacity-40" />
                      <span>
                        {isLoadingToBalance ? "—" : `${formattedToBalance} ${toToken.symbol}`}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="text-xs font-mono bg-zinc-900 border-zinc-700"
                  >
                    <p className="text-white/90">Full balance:</p>
                    <p className="text-white/70">
                      {toBalanceValue.toLocaleString("en-US", {
                        maximumFractionDigits: 18,
                        useGrouping: false,
                      })}{" "}
                      {toToken.symbol}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* ACTION BUTTON */}
      <button
        disabled={insufficientBalance}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!insufficientBalance && onGetStarted) {
            onGetStarted()
          }
        }}
        className={cn(
          "mt-1 w-full py-4 rounded-[20px] font-bold text-lg transition-all border border-white/10",
          insufficientBalance
            ? "bg-zinc-900/50 text-zinc-600 cursor-not-allowed"
            : "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
        )}
      >
        {insufficientBalance
          ? `Not enough ${editingSide === "sell" ? fromToken?.symbol || "" : toToken?.symbol || ""}`
          : "Get Started"}
      </button>

      {/* Token Selectors */}
      <TokenSelector
        open={isFromTokenSelectorOpen}
        onOpenChange={setIsFromTokenSelectorOpen}
        tokens={tokens.length > 0 ? tokens : [DEFAULT_ETH_TOKEN]}
        selectedToken={fromToken}
        onSelect={handleFromTokenSelect}
      />
      <TokenSelector
        open={isToTokenSelectorOpen}
        onOpenChange={setIsToTokenSelectorOpen}
        tokens={
          tokens.length > 0
            ? tokens.filter((t) => t.address !== fromToken?.address)
            : [DEFAULT_ETH_TOKEN]
        }
        selectedToken={toToken}
        onSelect={handleToTokenSelect}
      />
    </div>
  )
}
