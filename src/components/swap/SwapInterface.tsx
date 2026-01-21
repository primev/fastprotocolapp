"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react"
import { ArrowDown, Wallet, AlertTriangle } from "lucide-react"
import { useAccount, useBalance } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { formatUnits } from "viem"
import { cn, formatTokenAmount, formatBalance } from "@/lib/utils"
import TokenSelector from "./TokenSelector"
import TokenSelectButton from "./TokenSelectButton"
import SwapSettings from "./SwapSettings"
import SwapReview from "./SwapReview"
import AmountInput from "./AmountInput"
import PercentageButtons from "./PercentageButtons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useQuote, getPriceImpactSeverity } from "@/hooks/use-quote"
import { useToast } from "@/hooks/use-toast"
import { useTokenPrice } from "@/hooks/use-token-price"
import { useSwapConfirmation } from "@/hooks/use-swap-confirmation"
import tokenList from "@/lib/token-list.json"
import type { Token } from "@/types/swap"
import { INTENT_DEADLINE_MINUTES, ZERO_ADDRESS } from "@/lib/swap-constants"

const SwapConfirmationModal = lazy(() => import("@/components/modals/SwapConfirmationModal"))

interface SwapInterfaceProps {
  onGetStarted?: () => void
  slippage?: string
  deadline?: number
  onSlippageChange?: (slippage: string) => void
  onDeadlineChange?: (deadline: number) => void
  onSettingsOpen?: () => void
}

const DEFAULT_ETH_TOKEN: Token = {
  address: ZERO_ADDRESS,
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
  logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
}

export default function SwapInterface({
  onGetStarted,
  slippage: externalSlippage,
  deadline: externalDeadline,
  onSlippageChange: externalOnSlippageChange,
  onDeadlineChange: externalOnDeadlineChange,
  onSettingsOpen,
}: SwapInterfaceProps = {}) {
  const { isConnected, address } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { toast } = useToast()

  const tokens = tokenList as Token[]

  const [internalSlippage, setInternalSlippage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("swapSlippage") || "0.5"
    }
    return "0.5"
  })
  const [internalDeadline, setInternalDeadline] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("swapDeadline")
      return saved ? parseInt(saved, 10) : INTENT_DEADLINE_MINUTES
    }
    return INTENT_DEADLINE_MINUTES
  })

  const slippage = externalSlippage !== undefined ? externalSlippage : internalSlippage
  const deadline = externalDeadline !== undefined ? externalDeadline : internalDeadline
  const handleSlippageChange = (newSlippage: string) => {
    if (externalOnSlippageChange) {
      externalOnSlippageChange(newSlippage)
    } else {
      setInternalSlippage(newSlippage)
      localStorage.setItem("swapSlippage", newSlippage)
    }
  }

  const handleDeadlineChange = (newDeadline: number) => {
    if (externalOnDeadlineChange) {
      externalOnDeadlineChange(newDeadline)
    } else {
      setInternalDeadline(newDeadline)
      localStorage.setItem("swapDeadline", newDeadline.toString())
    }
  }

  useEffect(() => {
    if (externalSlippage !== undefined) {
      setInternalSlippage(externalSlippage)
    }
  }, [externalSlippage])

  useEffect(() => {
    if (externalDeadline !== undefined) {
      setInternalDeadline(externalDeadline)
    }
  }, [externalDeadline])

  const [hasStarted, setHasStarted] = useState(false)
  const [isDockVisible, setIsDockVisible] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isReviewAccordionOpen, setIsReviewAccordionOpen] = useState(false)
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [fromToken, setFromToken] = useState<Token | undefined>(DEFAULT_ETH_TOKEN)
  const [toToken, setToToken] = useState<Token | undefined>(undefined)
  const [isFromTokenSelectorOpen, setIsFromTokenSelectorOpen] = useState(false)
  const [isToTokenSelectorOpen, setIsToTokenSelectorOpen] = useState(false)

  const { price: fromTokenPrice, isLoading: isLoadingFromPrice } = useTokenPrice(
    fromToken?.symbol || ""
  )
  const { price: toTokenPrice, isLoading: isLoadingToPrice } = useTokenPrice(toToken?.symbol || "")
  const { price: ethPrice } = useTokenPrice("ETH")
  const [timeLeft, setTimeLeft] = useState(15)
  const [displayQuote, setDisplayQuote] = useState<string | null>(null)
  const [pendingQuote, setPendingQuote] = useState<string | null>(null)
  const hasRefetchedRef = useRef(false)
  const [pulseKey, setPulseKey] = useState(0)
  const [pulseAnimationKey, setPulseAnimationKey] = useState(0)
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastQuoteAmountRef = useRef<string | null>(null)
  const isSwitchingRef = useRef(false)
  const sellInputRef = useRef<HTMLInputElement>(null)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [editingSide, setEditingSide] = useState<"sell" | "buy">("sell")
  const {
    quote,
    isLoading: isQuoteLoading,
    error: quoteError,
    refetch,
  } = useQuote({
    tokenIn: fromToken?.symbol || "",
    tokenOut: toToken?.symbol || "",
    amountIn: amount,
    slippage: slippage,
    debounceMs: 100,
    tradeType: editingSide === "sell" ? "exactIn" : "exactOut",
    enabled:
      !isSwitchingRef.current &&
      !!amount &&
      parseFloat(amount) > 0 &&
      !!fromToken &&
      !!toToken &&
      !!fromToken?.symbol &&
      !!toToken?.symbol,
  })

  const handleFromTokenSelect = useCallback(
    (token: Token | undefined) => {
      setFromToken(token)
      setTimeout(() => {
        refetch()
      }, 0)
    },
    [refetch]
  )

  const handleToTokenSelect = useCallback(
    (token: Token | undefined) => {
      setToToken(token)
      setTimeout(() => {
        refetch()
      }, 0)
    },
    [refetch]
  )

  useEffect(() => {
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
      const quoteId =
        editingSide === "sell" ? quote.amountOut.toString() : quote.amountIn.toString()
      const isNewQuote = quoteId !== lastQuoteAmountRef.current

      if (isNewQuote) {
        if (isQuoteLoading) {
          setPendingQuote(quoteValue)
        } else {
          setDisplayQuote(quoteValue)
          setPendingQuote(null)
        }

        if (isNewQuote) {
          lastQuoteAmountRef.current = quoteId
          setTimeLeft(15)
          hasRefetchedRef.current = false
        }
      }
    } else {
      setDisplayQuote(null)
      setPendingQuote(null)
      lastQuoteAmountRef.current = null
    }
  }, [quote, editingSide, isQuoteLoading])

  useEffect(() => {
    if (isSwitchingRef.current) {
      return
    }

    if (!amount || parseFloat(amount) <= 0 || !fromToken || !toToken) {
      setDisplayQuote(null)
      lastQuoteAmountRef.current = null
      hasRefetchedRef.current = false
    }
  }, [amount, fromToken, toToken])
  useEffect(() => {
    if (!displayQuote) {
      setTimeLeft(15)
      hasRefetchedRef.current = false
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1

        if (newTime === 3) {
          hasRefetchedRef.current = true
          setPulseKey((k) => k + 1)
          setTimeout(() => {
            refetch()
          }, 0)
        }

        if (newTime <= 0) {
          hasRefetchedRef.current = false
          setPulseKey(0)
          refetch()
          return 15
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [displayQuote, refetch, quote])

  const outputAmount =
    displayQuote ||
    (editingSide === "sell" ? quote?.amountOutFormatted || "0" : quote?.amountInFormatted || "0") ||
    "0"
  const shouldPulse = (isQuoteLoading || pulseKey > 0) && displayQuote !== null
  const shouldPulseLoop = isQuoteLoading && displayQuote !== null

  const loadingStartTimeRef = useRef<number | null>(null)
  useEffect(() => {
    if (isQuoteLoading && displayQuote !== null) {
      loadingStartTimeRef.current = Date.now()
      setPulseAnimationKey((prev) => prev + 1)
    }
  }, [isQuoteLoading, displayQuote])

  useEffect(() => {
    if (!isQuoteLoading && pendingQuote) {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current)
      }

      const loadingDuration = loadingStartTimeRef.current
        ? Date.now() - loadingStartTimeRef.current
        : 0

      const timeInCurrentCycle = loadingDuration % 6000
      let waitTime = 0

      if (timeInCurrentCycle < 2880) {
        waitTime = 2880 - timeInCurrentCycle
      } else {
        waitTime = 6000 - timeInCurrentCycle + 2880
      }

      waitTime = Math.max(waitTime, 100)

      pulseTimeoutRef.current = setTimeout(() => {
        setDisplayQuote(pendingQuote)
        setPendingQuote(null)
        setPulseKey(0)
        loadingStartTimeRef.current = null
      }, waitTime)
    }

    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current)
      }
    }
  }, [isQuoteLoading, pendingQuote])

  const [hasExplicitlyClearedFromToken, setHasExplicitlyClearedFromToken] = useState(false)
  const [hasExplicitlyClearedToToken, setHasExplicitlyClearedToToken] = useState(false)

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

  useEffect(() => {
    if (hasExplicitlyClearedFromToken) return

    if (!isConnected) {
      const ethToken = tokens.find((t) => t.symbol === "ETH") || DEFAULT_ETH_TOKEN
      setFromToken(ethToken)
    } else if (tokens.length > 0 && !fromToken) {
      const ethToken = tokens.find((t) => t.symbol === "ETH") || DEFAULT_ETH_TOKEN
      setFromToken(ethToken)
    }
  }, [isConnected, tokens, fromToken, hasExplicitlyClearedFromToken])
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

    if (editingSide === "sell") {
      if (!fromToken || !fromBalance) {
        setInsufficientBalance(false)
        return
      }
      const exceedsBalance = amountValue > fromBalanceValue + 0.0000001
      setInsufficientBalance(exceedsBalance)
    } else {
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

  useEffect(() => {
    if (sellInputRef.current) {
      const timer = setTimeout(() => {
        sellInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [])
  const commonTokens = useMemo(() => {
    const symbols = ["ETH", "USDC", "USDT", "WBTC", "WETH"]
    const foundTokens: Token[] = []

    if (!fromToken || fromToken.symbol.toUpperCase() !== "ETH") {
      const ethToken = tokens.find((t) => t.symbol.toUpperCase() === "ETH") || DEFAULT_ETH_TOKEN
      foundTokens.push(ethToken)
    }

    symbols.forEach((symbol) => {
      if (symbol.toUpperCase() === "ETH") return

      const token = tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase())

      if (token && token.address !== fromToken?.address) {
        foundTokens.push(token)
      }
    })

    return foundTokens
  }, [tokens, fromToken])

  const exchangeRate = useMemo(() => {
    if (!quote || !fromToken || !toToken) return 0
    const amountIn = parseFloat(quote.amountInFormatted)
    const amountOut = parseFloat(quote.amountOutFormatted)
    if (amountIn === 0) return 0
    return amountOut / amountIn
  }, [quote, fromToken, toToken])

  const minAmountOut = useMemo(() => {
    if (!quote || !toToken) return "0"
    const slippagePercent = parseFloat(slippage) || 0.5
    const amountOut = parseFloat(quote.amountOutFormatted)
    const minOut = amountOut * (1 - slippagePercent / 100)
    return formatTokenAmount(minOut.toString(), toToken.symbol)
  }, [quote, slippage, toToken])

  const { confirmSwap, isSigning, isSubmitting } = useSwapConfirmation({
    fromToken,
    toToken,
    amount,
    minAmountOut,
    deadline,
    onSuccess: () => {
      setAmount("")
      setDisplayQuote(null)
      setPendingQuote(null)
      lastQuoteAmountRef.current = null
    },
  })

  const priceImpactSeverity = quote ? getPriceImpactSeverity(quote.priceImpact) : "low"
  const hasHighPriceImpact = quote ? Math.abs(quote.priceImpact) > 3 : false
  const hasVeryHighPriceImpact = quote ? Math.abs(quote.priceImpact) > 10 : false

  const handleSwapClick = () => {
    if (!isConnected) {
      openConnectModal?.()
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
    await confirmSwap()
  }

  useEffect(() => {
    if (hasStarted) {
      const timer = setTimeout(() => {
        setIsDockVisible(true)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setIsDockVisible(false)
    }
  }, [hasStarted])

  const handleGetStarted = () => {
    setHasStarted(true)
    if (onGetStarted) {
      onGetStarted()
    }
  }

  return (
    <div className="w-full flex flex-col items-stretch group">
      {hasStarted && (
        <div
          className={cn(
            "relative flex items-center justify-between bg-[#131313] border-x border-t border-white/10 rounded-t-[24px] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden",
            isDockVisible
              ? "h-[54px] opacity-100 py-3 px-5 mb-0"
              : "h-0 opacity-0 py-0 px-5 -mb-2 scale-[0.98] pointer-events-none"
          )}
        >
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

          <div className="flex-1">
            <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/20">
              Fast Swap
            </span>
          </div>

          {/* <div className="px-4 py-1 rounded-full bg-white/[0.03] border border-white/5">
            <span className="text-xs font-semibold text-white/90 uppercase tracking-widest">
              Swap
            </span>
          </div> */}

          <div className="flex-1 flex justify-end">
            <SwapSettings
              slippage={slippage}
              deadline={deadline}
              onSlippageChange={handleSlippageChange}
              onDeadlineChange={handleDeadlineChange}
              isOpen={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
            />
          </div>
        </div>
      )}

      <div
        className={cn(
          "w-full bg-[#131313] border border-white/10 p-2 flex flex-col gap-1 shadow-2xl relative z-10 transition-all duration-500",
          isDockVisible ? "rounded-b-[24px] rounded-t-none border-t-0" : "rounded-[24px]"
        )}
      >
        <div
          className={cn(
            "group/sell rounded-[20px] p-4 flex flex-col gap-2 transition-all min-h-[140px]",
            editingSide === "sell" ? "bg-[#222] shadow-2xl" : "bg-[#1B1B1B]/50"
          )}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Sell
            </span>
            <PercentageButtons
              balance={fromBalance}
              token={fromToken}
              isConnected={isConnected}
              onSelect={setAmount}
            />
          </div>

          <div className="flex justify-between items-center mt-1">
            <AmountInput
              value={
                editingSide === "sell" ? amount : displayQuote || quote?.amountInFormatted || "0"
              }
              onChange={(value) => {
                setEditingSide("sell")
                setAmount(value)
              }}
              onFocus={() => setEditingSide("sell")}
              onBlur={() => {
                if (amount) {
                  const num = parseFloat(amount)
                  if (!isNaN(num)) {
                    setAmount(num.toString())
                  }
                }
              }}
              isActive={editingSide === "sell"}
              isDisabled={!isConnected}
              showError={insufficientBalance && editingSide === "sell"}
              shouldPulse={shouldPulse}
              shouldPulseLoop={shouldPulseLoop}
              isQuoteLoading={isQuoteLoading}
              pulseAnimationKey={pulseAnimationKey}
              inputRef={sellInputRef}
            />
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
                          {isLoadingFromBalance
                            ? "—"
                            : `${formattedFromBalance} ${fromToken.symbol}`}
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

        <div className="relative h-2 w-full flex justify-center z-20">
          <button
            onClick={() => {
              isSwitchingRef.current = true
              setInsufficientBalance(false)
              setPulseKey(0)
              setPulseAnimationKey(0)
              if (pulseTimeoutRef.current) {
                clearTimeout(pulseTimeoutRef.current)
                pulseTimeoutRef.current = null
              }

              const currentSellValue =
                editingSide === "sell" ? amount : displayQuote || quote?.amountInFormatted || ""
              const currentBuyValue =
                editingSide === "buy" ? amount : displayQuote || quote?.amountOutFormatted || ""

              const tempFromToken = fromToken
              const tempToToken = toToken

              setFromToken(tempToToken)
              setToToken(tempFromToken)

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

              if (editingSide === "sell") {
                setDisplayQuote(currentBuyValue || "")
                setAmount(currentSellValue || "")
                setEditingSide("buy")
              } else {
                setDisplayQuote(currentSellValue || "")
                setAmount(currentBuyValue || "")
                setEditingSide("sell")
              }

              setTimeout(() => {
                isSwitchingRef.current = false
              }, 100)

              setPendingQuote(null)
              lastQuoteAmountRef.current = null
            }}
            className="absolute -top-4 p-2 bg-[#1B1B1B] border-[4px] border-[#131313] rounded-xl hover:scale-110 transition-transform text-white shadow-lg"
          >
            <ArrowDown size={18} strokeWidth={3} />
          </button>
        </div>

        <div
          className={cn(
            "group/buy relative rounded-[20px] p-4 flex flex-col gap-2 transition-all min-h-[140px]",
            editingSide === "buy" ? "bg-[#222] shadow-2xl" : "bg-[#1B1B1B]/50"
          )}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Buy
            </span>
            <TooltipProvider delayDuration={0}>
              <div
                className={cn(
                  "flex gap-1.5 transition-opacity duration-200",
                  commonTokens.length > 0
                    ? "opacity-0 group-hover/buy:opacity-100"
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
            <AmountInput
              value={
                editingSide === "buy" ? amount : displayQuote || quote?.amountOutFormatted || "0"
              }
              onChange={(value) => {
                setEditingSide("buy")
                setAmount(value)
              }}
              onFocus={() => setEditingSide("buy")}
              onBlur={() => {
                if (amount) {
                  const num = parseFloat(amount)
                  if (!isNaN(num)) {
                    setAmount(num.toString())
                  }
                }
              }}
              isActive={editingSide === "buy"}
              isDisabled={!isConnected}
              showError={false}
              shouldPulse={shouldPulse}
              shouldPulseLoop={shouldPulseLoop}
              isQuoteLoading={isQuoteLoading}
              pulseAnimationKey={pulseAnimationKey}
            />
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

        {hasStarted && quote && fromToken && toToken && (
          <SwapReview
            fromToken={fromToken}
            toToken={toToken}
            quote={quote}
            exchangeRate={exchangeRate}
            minAmountOut={minAmountOut}
            slippage={slippage}
            ethPrice={ethPrice}
            timeLeft={timeLeft}
            displayQuote={displayQuote}
            hasHighPriceImpact={hasHighPriceImpact}
            isOpen={isReviewAccordionOpen}
            onOpenChange={setIsReviewAccordionOpen}
            onSettingsOpen={() => setIsSettingsOpen(true)}
            onTokenSwap={() => {
              const tempFrom = fromToken
              const tempTo = toToken
              setFromToken(tempTo)
              setToToken(tempFrom)
            }}
          />
        )}

        {hasStarted && quoteError && amount && parseFloat(amount) > 0 && fromToken && toToken && (
          <div className="px-4 py-2">
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-500">Quote Error</p>
                <p className="text-xs text-red-500/80 mt-0.5">
                  {quoteError.message || "Failed to fetch quote. Please try again."}
                </p>
              </div>
            </div>
          </div>
        )}

        {!hasStarted ? (
          <button
            disabled={insufficientBalance}
            onClick={handleGetStarted}
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
        ) : (
          <button
            disabled={
              insufficientBalance ||
              !isConnected ||
              !fromToken ||
              !toToken ||
              !amount ||
              parseFloat(amount) <= 0 ||
              !quote ||
              hasVeryHighPriceImpact ||
              isSigning ||
              isSubmitting
            }
            onClick={handleSwapClick}
            className={cn(
              "mt-2 mx-2 mb-2 w-[calc(100%-1rem)] py-4 rounded-[16px] font-semibold text-base transition-all duration-200",
              insufficientBalance ||
                !isConnected ||
                !fromToken ||
                !toToken ||
                !amount ||
                parseFloat(amount) <= 0 ||
                !quote ||
                hasVeryHighPriceImpact ||
                isSigning ||
                isSubmitting
                ? "bg-[#1B1B1B] text-white/40 cursor-not-allowed border border-white/5"
                : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-[1.01]"
            )}
          >
            {isSigning
              ? "Signing..."
              : isSubmitting
                ? "Submitting..."
                : !isConnected
                  ? "Connect Wallet"
                  : insufficientBalance
                    ? `Not enough ${editingSide === "sell" ? fromToken?.symbol || "" : toToken?.symbol || ""}`
                    : !fromToken || !toToken
                      ? "Select Tokens"
                      : !amount || parseFloat(amount) <= 0
                        ? "Enter Amount"
                        : !quote
                          ? "Loading Quote..."
                          : hasVeryHighPriceImpact
                            ? "Price Impact Too High"
                            : "Swap"}
          </button>
        )}

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

        {hasStarted && (
          <Suspense fallback={null}>
            <SwapConfirmationModal
              open={isConfirmationOpen}
              onOpenChange={setIsConfirmationOpen}
              onConfirm={handleConfirmSwap}
              tokenIn={fromToken}
              tokenOut={toToken}
              amountIn={amount}
              amountOut={quote?.amountOutFormatted || "0"}
              minAmountOut={minAmountOut}
              exchangeRate={exchangeRate}
              priceImpact={quote?.priceImpact || 0}
              slippage={slippage}
              gasEstimate={quote?.gasEstimate || null}
              ethPrice={ethPrice}
              timeLeft={timeLeft}
              isLoading={isSigning || isSubmitting}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
