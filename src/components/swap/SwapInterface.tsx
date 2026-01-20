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

export default function SwapInterface() {
  const { isConnected, address } = useAccount()
  const { openConnectModal } = useConnectModal()

  // Use token list from JSON file
  const tokens = tokenList as Token[]

  const [amount, setAmount] = useState("")
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [fromToken, setFromToken] = useState<Token | undefined>(DEFAULT_ETH_TOKEN)
  const [toToken, setToToken] = useState<Token | undefined>(undefined)
  const [isFromTokenSelectorOpen, setIsFromTokenSelectorOpen] = useState(false)
  const [isToTokenSelectorOpen, setIsToTokenSelectorOpen] = useState(false)
  const [fromTokenPrice, setFromTokenPrice] = useState<number | null>(null)
  const [toTokenPrice, setToTokenPrice] = useState<number | null>(null)
  const [isLoadingFromPrice, setIsLoadingFromPrice] = useState(false)
  const [isLoadingToPrice, setIsLoadingToPrice] = useState(false)
  const [isSellSideActive, setIsSellSideActive] = useState(true) // Track which side has the input
  const [timeLeft, setTimeLeft] = useState(15) // Quote expiration timer
  const [displayQuote, setDisplayQuote] = useState<string | null>(null)
  const hasRefetchedRef = useRef(false)
  const [pulseKey, setPulseKey] = useState(0) // Key to trigger animation
  const lastQuoteAmountRef = useRef<string | null>(null) // Track last quote amount to detect changes
  const quoteTimestampRef = useRef<number>(0) // Track when quote was last updated

  // Use new quote hook to calculate output amount
  // When sell side is active: fromToken -> toToken
  // When buy side is active: toToken -> fromToken
  const {
    quote,
    isLoading: isQuoteLoading,
    refetch,
  } = useQuote({
    tokenIn: isSellSideActive && fromToken ? fromToken.symbol : toToken?.symbol || "",
    tokenOut: isSellSideActive && toToken ? toToken.symbol : fromToken?.symbol || "",
    amountIn: amount,
    slippage: "0.5",
    enabled:
      !!amount &&
      parseFloat(amount) > 0 &&
      !!fromToken &&
      !!toToken &&
      (isSellSideActive ? !!fromToken?.symbol : !!toToken?.symbol) &&
      (isSellSideActive ? !!toToken?.symbol : !!fromToken?.symbol),
  })

  // Always update displayQuote when we get a quote
  // Force update to show latest value even if it appears the same
  useEffect(() => {
    if (quote?.amountOutFormatted) {
      const quoteId = quote.amountOut.toString()
      const isNewQuote = quoteId !== lastQuoteAmountRef.current

      // Always update displayQuote to show latest value
      // This ensures the UI reflects the most recent quote
      setDisplayQuote(quote.amountOutFormatted)

      // If it's a genuinely new quote, update tracking and reset timer
      if (isNewQuote) {
        lastQuoteAmountRef.current = quoteId
        setTimeLeft(15) // Reset timer when new quote arrives
        hasRefetchedRef.current = false
        // Don't reset pulseKey here - let animation complete if in progress
      }
    }
  }, [quote?.amountOutFormatted, quote?.exchangeRate, quote?.amountOut]) // Depend on specific fields to catch all changes

  // Clear displayQuote when inputs are invalid
  useEffect(() => {
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
  const outputAmount = displayQuote || quote?.amountOutFormatted || "0"
  // Pulse when pulseKey > 0 (triggered when timeLeft reaches 3, animation runs for 3s)
  const shouldPulse = pulseKey > 0 && displayQuote !== null

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
          "group rounded-[20px] p-4 flex flex-col gap-2 border transition-all",
          isSellSideActive
            ? "bg-[#222] border border-white/30 shadow-2xl ring-1 ring-white/8"
            : "bg-[#1B1B1B] border border-transparent focus-within:border-white/5"
        )}
      >
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Sell
          </span>
          {/* Quick Select Percentages - Always rendered to prevent layout shift */}
          <div
            className={cn(
              "flex gap-1 transition-opacity duration-200",
              isSellSideActive && isConnected && fromBalance && fromToken
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
                  onClick={handlePercentageClick}
                  className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-bold text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                >
                  {pct}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
          {isSellSideActive ? (
            // Show input when sell side is active
            (() => {
              const displayValue =
                isInputFocused || !amount ? amount : formatDisplayAmount(amount, fromToken)
              const fullValue =
                amount && parseFloat(amount) > 0 ? parseFloat(amount).toString() : null
              const isTrimmed = fullValue && displayValue !== fullValue

              if (isTrimmed) {
                return (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={displayValue}
                            onChange={(e) => {
                              // Allow user to type freely, store raw value
                              const value = e.target.value.replace(/[^0-9.]/g, "")
                              // Prevent multiple decimal points
                              const parts = value.split(".")
                              const cleaned =
                                parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value
                              setAmount(cleaned)
                            }}
                            onFocus={() => setIsInputFocused(true)}
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
                            className="bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none"
                            disabled={!isConnected}
                          />
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
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                      // Allow user to type freely, store raw value
                      const value = e.target.value.replace(/[^0-9.]/g, "")
                      // Prevent multiple decimal points
                      const parts = value.split(".")
                      const cleaned =
                        parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value
                      setAmount(cleaned)
                    }}
                    onFocus={() => setIsInputFocused(true)}
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
                    className="bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none"
                    disabled={!isConnected}
                  />
                </div>
              )
            })()
          ) : (
            // Show quote output when sell side is not active
            <div className="flex-1 relative">
              <span
                key={pulseKey}
                className={cn(
                  "text-4xl font-medium text-white block leading-none",
                  shouldPulse && "animate-pulse-3"
                )}
              >
                {isQuoteLoading && !displayQuote
                  ? "—"
                  : outputAmount && parseFloat(outputAmount) > 0
                    ? formatDisplayAmount(outputAmount, fromToken)
                    : "0"}
              </span>
            </div>
          )}
          <TokenSelectButton
            token={fromToken}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsFromTokenSelectorOpen(true)
            }}
          />
        </div>

        <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
          <span>
            {(() => {
              const displayAmount = isSellSideActive ? amount : outputAmount
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
                    <span>
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

      {/* SWITCH BUTTON (Centered) */}
      <div className="relative h-2 w-full flex justify-center z-20">
        <button
          onClick={() => {
            // Store current values before swapping
            const tempFromToken = fromToken
            const tempToToken = toToken
            const currentAmount = amount // Preserve the input amount

            // Swap tokens
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

            // Keep the same amount - it will now be used for the new fromToken
            // The quote will automatically recalculate for the new token pair
            setAmount(currentAmount || "")

            // Swap which side is active (input side)
            setIsSellSideActive(!isSellSideActive)

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
          "group relative rounded-[20px] p-4 flex flex-col gap-2 border transition-all",
          !isSellSideActive
            ? "bg-[#222] border border-white/30 shadow-2xl ring-1 ring-white/8"
            : "bg-[#1B1B1B] border border-transparent hover:bg-[#1e1e1e]"
        )}
      >
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Buy
          </span>
          {/* Quick Select Percentages - Always rendered to prevent layout shift */}
          <div
            className={cn(
              "flex gap-1 transition-opacity duration-200",
              !isSellSideActive && isConnected && toBalance && toToken
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-0 pointer-events-none"
            )}
          >
            {["25%", "50%", "75%", "Max"].map((pct) => {
              const handlePercentageClick = () => {
                if (!toBalance || !toToken) return

                const balanceValue = parseFloat(formatUnits(toBalance.value, toToken.decimals))

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
                  onClick={handlePercentageClick}
                  className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-bold text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                >
                  {pct}
                </button>
              )
            })}
          </div>
          {/* Common Tokens Quick Select - Always rendered to prevent layout shift */}
          <TooltipProvider delayDuration={0}>
            <div
              className={cn(
                "flex gap-1.5 transition-opacity duration-200",
                isSellSideActive && commonTokens.length > 0
                  ? "pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              )}
            >
              {commonTokens.map((token) => (
                <Tooltip key={token.address}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setToToken(token)}
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
          {!isSellSideActive ? (
            // Show input when buy side is active
            (() => {
              const displayValue =
                isInputFocused || !amount ? amount : formatDisplayAmount(amount, toToken)
              const fullValue =
                amount && parseFloat(amount) > 0 ? parseFloat(amount).toString() : null
              const isTrimmed = fullValue && displayValue !== fullValue

              if (isTrimmed) {
                return (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={displayValue}
                            onChange={(e) => {
                              // Allow user to type freely, store raw value
                              const value = e.target.value.replace(/[^0-9.]/g, "")
                              // Prevent multiple decimal points
                              const parts = value.split(".")
                              const cleaned =
                                parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value
                              setAmount(cleaned)
                            }}
                            onFocus={() => setIsInputFocused(true)}
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
                            className="bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none"
                            disabled={!isConnected}
                          />
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
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                      // Allow user to type freely, store raw value
                      const value = e.target.value.replace(/[^0-9.]/g, "")
                      // Prevent multiple decimal points
                      const parts = value.split(".")
                      const cleaned =
                        parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value
                      setAmount(cleaned)
                    }}
                    onFocus={() => setIsInputFocused(true)}
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
                    className="bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none"
                    disabled={!isConnected}
                  />
                </div>
              )
            })()
          ) : (
            // Show quote output when buy side is not active
            <div className="flex-1 relative">
              <span
                key={pulseKey}
                className={cn(
                  "text-4xl font-medium text-white block leading-none",
                  shouldPulse && "animate-pulse-3"
                )}
              >
                {isQuoteLoading && !displayQuote
                  ? "—"
                  : outputAmount && parseFloat(outputAmount) > 0
                    ? formatDisplayAmount(outputAmount, toToken)
                    : "0"}
              </span>
            </div>
          )}
          <TokenSelectButton
            token={toToken}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsToTokenSelectorOpen(true)
            }}
          />
        </div>

        <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
          <span>
            {(() => {
              const displayAmount = !isSellSideActive ? amount : outputAmount
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

      {/* ACTION BUTTON */}
      <button className="mt-1 w-full py-4 rounded-[20px] bg-primary/10 text-primary hover:bg-primary/20 font-bold text-lg transition-all">
        Get Started
      </button>

      {/* Token Selectors */}
      <TokenSelector
        open={isFromTokenSelectorOpen}
        onOpenChange={setIsFromTokenSelectorOpen}
        tokens={tokens.length > 0 ? tokens : [DEFAULT_ETH_TOKEN]}
        selectedToken={fromToken}
        onSelect={setFromToken}
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
        onSelect={setToToken}
      />
    </div>
  )
}
