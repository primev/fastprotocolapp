"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react"
import { useAccount, useBalance } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { formatUnits } from "viem"
import { cn, formatTokenAmount, formatBalance } from "@/lib/utils"
import TokenSelector from "./TokenSelector"
import TokenSelectButton from "./TokenSelectButton"
import SwapSettings from "./SwapSettings"
import SwapReview from "./SwapReview"
import SwapDock from "./SwapDock"
import TokenSwapSection from "./TokenSwapSection"
import SwitchButton from "./SwitchButton"
import SwapActionButton from "./SwapActionButton"
import QuoteErrorDisplay from "./QuoteErrorDisplay"
import { useTokenSwitch } from "@/hooks/use-token-switch"
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

  const { handleSwitch } = useTokenSwitch({
    fromToken,
    toToken,
    amount,
    displayQuote,
    editingSide,
    quote,
    onSwitch: useCallback(
      ({
        newFromToken,
        newToToken,
        newAmount,
        newDisplayQuote,
        newEditingSide,
        hasExplicitlyClearedFromToken: newHasExplicitlyClearedFromToken,
        hasExplicitlyClearedToToken: newHasExplicitlyClearedToToken,
      }) => {
        isSwitchingRef.current = true
        setInsufficientBalance(false)
        setPulseKey(0)
        setPulseAnimationKey(0)
        if (pulseTimeoutRef.current) {
          clearTimeout(pulseTimeoutRef.current)
          pulseTimeoutRef.current = null
        }

        setFromToken(newFromToken)
        setToToken(newToToken)
        setHasExplicitlyClearedFromToken(newHasExplicitlyClearedFromToken)
        setHasExplicitlyClearedToToken(newHasExplicitlyClearedToToken)
        setDisplayQuote(newDisplayQuote)
        setAmount(newAmount)
        setEditingSide(newEditingSide)

        setTimeout(() => {
          isSwitchingRef.current = false
        }, 100)

        setPendingQuote(null)
        lastQuoteAmountRef.current = null
      },
      []
    ),
  })

  return (
    <div className="w-full flex flex-col items-stretch group">
      {hasStarted && (
        <div
          className={cn(
            "transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isDockVisible
              ? "h-[54px] opacity-100 mb-0"
              : "h-0 opacity-0 -mb-2 scale-[0.98] pointer-events-none"
          )}
        >
          <SwapDock
            isVisible={isDockVisible}
            slippage={slippage}
            deadline={deadline}
            onSlippageChange={handleSlippageChange}
            onDeadlineChange={handleDeadlineChange}
            isSettingsOpen={isSettingsOpen}
            onSettingsOpenChange={setIsSettingsOpen}
          />
        </div>
      )}

      <div
        className={cn(
          "w-full bg-[#131313] border border-white/10 p-2 flex flex-col gap-1 shadow-2xl relative z-10 transition-all duration-500",
          isDockVisible ? "rounded-b-[24px] rounded-t-none border-t-0" : "rounded-[24px]"
        )}
      >
        <TokenSwapSection
          side="sell"
          label="Sell"
          isActive={editingSide === "sell"}
          token={fromToken}
          amount={amount}
          displayQuote={displayQuote}
          quoteAmount={quote?.amountInFormatted}
          onAmountChange={(value) => {
            setEditingSide("sell")
            setAmount(value)
          }}
          onAmountFocus={() => setEditingSide("sell")}
          onAmountBlur={() => {
            if (amount) {
              const num = parseFloat(amount)
              if (!isNaN(num)) {
                setAmount(num.toString())
              }
            }
          }}
          onTokenSelect={() => setIsFromTokenSelectorOpen(true)}
          balance={fromBalance}
          balanceValue={fromBalanceValue}
          formattedBalance={formattedFromBalance}
          isLoadingBalance={isLoadingFromBalance}
          tokenPrice={fromTokenPrice}
          isLoadingPrice={isLoadingFromPrice}
          isConnected={isConnected}
          address={address}
          insufficientBalance={insufficientBalance}
          shouldPulse={shouldPulse}
          shouldPulseLoop={shouldPulseLoop}
          isQuoteLoading={isQuoteLoading}
          pulseAnimationKey={pulseAnimationKey}
          inputRef={sellInputRef}
          outputAmount={outputAmount}
        />

        <SwitchButton onSwitch={handleSwitch} />

        <TokenSwapSection
          side="buy"
          label="Buy"
          isActive={editingSide === "buy"}
          token={toToken}
          amount={amount}
          displayQuote={displayQuote}
          quoteAmount={quote?.amountOutFormatted}
          onAmountChange={(value) => {
            setEditingSide("buy")
            setAmount(value)
          }}
          onAmountFocus={() => setEditingSide("buy")}
          onAmountBlur={() => {
            if (amount) {
              const num = parseFloat(amount)
              if (!isNaN(num)) {
                setAmount(num.toString())
              }
            }
          }}
          onTokenSelect={() => setIsToTokenSelectorOpen(true)}
          balance={toBalance}
          balanceValue={toBalanceValue}
          formattedBalance={formattedToBalance}
          isLoadingBalance={isLoadingToBalance}
          tokenPrice={toTokenPrice}
          isLoadingPrice={isLoadingToPrice}
          isConnected={isConnected}
          address={address}
          insufficientBalance={false}
          shouldPulse={shouldPulse}
          shouldPulseLoop={shouldPulseLoop}
          isQuoteLoading={isQuoteLoading}
          pulseAnimationKey={pulseAnimationKey}
          outputAmount={outputAmount}
          commonTokens={commonTokens}
          onCommonTokenSelect={handleToTokenSelect}
        />

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

        <QuoteErrorDisplay
          error={quoteError}
          show={
            hasStarted &&
            !!quoteError &&
            !!amount &&
            parseFloat(amount) > 0 &&
            !!fromToken &&
            !!toToken
          }
        />

        <SwapActionButton
          hasStarted={hasStarted}
          insufficientBalance={insufficientBalance}
          isConnected={isConnected}
          fromToken={fromToken}
          toToken={toToken}
          amount={amount}
          quote={quote}
          hasVeryHighPriceImpact={hasVeryHighPriceImpact}
          isSigning={isSigning}
          isSubmitting={isSubmitting}
          editingSide={editingSide}
          onGetStarted={handleGetStarted}
          onSwap={handleSwapClick}
        />

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
