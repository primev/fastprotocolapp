"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useAccount, useBalance } from "wagmi"
import { formatUnits } from "viem"
import { useQuote, calculateAutoSlippage, type QuoteResult } from "@/hooks/use-quote-v2"
import { useTokenPrice } from "@/hooks/use-token-price"
import { useGasPrice } from "@/hooks/use-gas-price"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import {
  isWrapUnwrapPair,
  isWrapOperation,
  isUnwrapOperation,
  estimateWrapGas,
  estimateUnwrapGas,
} from "@/lib/weth-utils"
import { ZERO_ADDRESS } from "@/lib/swap-constants"
import { useSwapPersistence } from "@/hooks/use-swap-persistence"
import { Token } from "@/types/swap"
import { DEFAULT_ETH_TOKEN } from "@/components/swap/TokenSelectorModal"

/**
 * useSwapForm - A centralized logic engine for the Swap UI.
 * Handles quoting, manual inversion logic, balance fetching, and WETH wrapping.
 */
export function useSwapForm(allTokens: Token[]) {
  const { address, isConnected } = useAccount()
  const settings = useSwapPersistence()

  // --- Core State ---
  const [fromToken, setFromToken] = useState<Token | undefined>(DEFAULT_ETH_TOKEN)
  const [toToken, setToToken] = useState<Token | undefined>(undefined)
  const [amount, setAmount] = useState("")
  const [editingSide, setEditingSide] = useState<"sell" | "buy">("sell")

  // --- UI Synchronicity State ---
  const [isManualInversion, setIsManualInversion] = useState(false)
  const [swappedQuote, setSwappedQuote] = useState<QuoteResult | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const [lastSwitchTime, setLastSwitchTime] = useState(0)

  // --- Caching State ---
  const [priceCache, setPriceCache] = useState<Record<string, number>>({})
  const [exchangeRateCache, setExchangeRateCache] = useState<Record<string, number>>({})
  const [quoteCache, setQuoteCache] = useState<Record<string, QuoteResult>>({})
  const [balanceCache, setBalanceCache] = useState<
    Record<string, { value: bigint; formatted: string }>
  >({})
  const [lastValidRate, setLastValidRate] = useState<string | null>(null)
  const [wrapUnwrapGasEstimate, setWrapUnwrapGasEstimate] = useState<bigint | null>(null)

  // --- Quote change tracking ---
  const prevQuoteRef = useRef<QuoteResult | null>(null)
  const prevExchangeRateContentRef = useRef<string | null>(null)

  // --- Market Data ---
  const { price: fromPrice, isLoading: isLoadingFromPrice } = useTokenPrice(fromToken?.symbol || "")
  const { price: toPrice, isLoading: isLoadingToPrice } = useTokenPrice(toToken?.symbol || "")
  const { gasPriceGwei } = useGasPrice()

  // --- Balances ---
  const {
    data: fromBalance,
    isLoading: isLoadingFromBalance,
    refetch: refetchFromBalance,
  } = useBalance({
    address: isConnected ? address : undefined,
    token: fromToken?.address !== ZERO_ADDRESS ? (fromToken?.address as `0x${string}`) : undefined,
  })
  const {
    data: toBalance,
    isLoading: isLoadingToBalance,
    refetch: refetchToBalance,
  } = useBalance({
    address: isConnected ? address : undefined,
    token: toToken?.address !== ZERO_ADDRESS ? (toToken?.address as `0x${string}`) : undefined,
  })

  // Cache balances when they load
  useEffect(() => {
    if (fromBalance && fromToken) {
      const key = fromToken.address
      const formatted = formatUnits(fromBalance.value, fromToken.decimals)
      setBalanceCache((prev) => ({ ...prev, [key]: { value: fromBalance.value, formatted } }))
    }
  }, [fromBalance, fromToken])

  useEffect(() => {
    if (toBalance && toToken) {
      const key = toToken.address
      const formatted = formatUnits(toBalance.value, toToken.decimals)
      setBalanceCache((prev) => ({ ...prev, [key]: { value: toBalance.value, formatted } }))
    }
  }, [toBalance, toToken])

  // Use cached balances for immediate display
  const cachedFromBalance = fromToken ? balanceCache[fromToken.address] : undefined
  const cachedToBalance = toToken ? balanceCache[toToken.address] : undefined

  const fromBalanceValue = cachedFromBalance
    ? parseFloat(cachedFromBalance.formatted)
    : fromBalance && fromToken
      ? parseFloat(formatUnits(fromBalance.value, fromToken.decimals))
      : 0

  const toBalanceValue = cachedToBalance
    ? parseFloat(cachedToBalance.formatted)
    : toBalance && toToken
      ? parseFloat(formatUnits(toBalance.value, toToken.decimals))
      : 0

  // --- Swap / Wrap Logic Detection ---
  const isWrapUnwrap = isWrapUnwrapPair(fromToken, toToken)

  // --- Cache Keys ---
  const pairKey = `${fromToken?.symbol || ""}-${toToken?.symbol || ""}`

  // --- Update Caches with Fresh Data ---
  useEffect(() => {
    if (fromToken?.symbol && fromPrice !== undefined && fromPrice !== null) {
      setPriceCache((prev) => ({ ...prev, [fromToken.symbol]: fromPrice }))
    }
  }, [fromToken?.symbol, fromPrice])

  useEffect(() => {
    if (toToken?.symbol && toPrice !== undefined && toPrice !== null) {
      setPriceCache((prev) => ({ ...prev, [toToken.symbol]: toPrice }))
    }
  }, [toToken?.symbol, toPrice])

  // --- Get Cached Values ---
  // Always prefer cached price, only fall back to fresh price if cache is empty
  const cachedFromPrice = priceCache[fromToken?.symbol || ""] ?? fromPrice ?? 0
  const cachedToPrice = priceCache[toToken?.symbol || ""] ?? toPrice ?? 0

  const cachedExchangeRate = exchangeRateCache[pairKey]
  const cachedQuote = quoteCache[pairKey]

  // --- Slippage Calculation ---
  const calculatedAutoSlippage = useMemo(() => {
    if (!settings.isAutoSlippage || !amount || !fromToken || !toToken) return null
    return calculateAutoSlippage(parseFloat(amount), fromToken, toToken, gasPriceGwei)
  }, [settings.isAutoSlippage, amount, fromToken, toToken, gasPriceGwei])

  const effectiveSlippage =
    settings.isAutoSlippage && calculatedAutoSlippage
      ? calculatedAutoSlippage.toFixed(2)
      : settings.slippage

  // --- Quoting Hook ---
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
    // CRITICAL: This determines if we are quoting "Sell" or "Buy"
    tradeType: editingSide === "sell" ? "exactIn" : "exactOut",
    tokenList: allTokens,
    enabled: !isSwitching && !!amount && !!fromToken && !!toToken && !isWrapUnwrap,
  })

  // Priority: Fresh Quote > Swapped/Inverted Quote > Cache
  const activeQuote = useMemo(() => {
    if (quote && !isQuoteLoading) return quote // Use fresh data if it exists
    if (isManualInversion && swappedQuote) return swappedQuote
    return null
  }, [isManualInversion, swappedQuote, quote, isQuoteLoading])

  // Use this for the actual UI display
  const displayQuote = activeQuote || cachedQuote

  // --- Update Quote Cache with Fresh Data ---
  useEffect(() => {
    if (quote && fromToken?.symbol && toToken?.symbol && !isManualInversion) {
      const pairKey = `${fromToken.symbol}-${toToken.symbol}`
      setExchangeRateCache((prev) => ({ ...prev, [pairKey]: quote.exchangeRate }))
      setQuoteCache((prev) => ({ ...prev, [pairKey]: quote }))
    }
  }, [quote, fromToken?.symbol, toToken?.symbol, isManualInversion])

  // --- Update Caches with Fresh Data ---
  useEffect(() => {
    if (fromToken?.symbol && fromPrice) {
      setPriceCache((prev) => ({ ...prev, [fromToken.symbol]: fromPrice }))
    }
  }, [fromToken?.symbol, fromPrice])

  useEffect(() => {
    if (toToken?.symbol && toPrice) {
      setPriceCache((prev) => ({ ...prev, [toToken.symbol]: toPrice }))
    }
  }, [toToken?.symbol, toPrice])

  // Logic Fix: Only show No Liquidity if we aren't currently showing a valid swapped quote
  const hasNoLiquidity = useMemo(() => {
    if (isManualInversion && swappedQuote) return false
    return noLiquidity || (quoteError && quoteError.message?.includes("No liquidity found"))
  }, [noLiquidity, quoteError, isManualInversion, swappedQuote])

  // --- WETH Wrap Context ---
  const wrapContext = useWethWrapUnwrap({
    fromToken,
    toToken,
    amount,
    enabled: isWrapUnwrap && !!amount,
  })

  // --- Gas Estimation for Wrap/Unwrap ---
  useEffect(() => {
    if (!isWrapUnwrap || !amount || !address || !isConnected) {
      setWrapUnwrapGasEstimate(null)
      return
    }

    const estimateGas = async () => {
      try {
        const isWrap = isWrapOperation(fromToken, toToken)
        const isUnwrap = isUnwrapOperation(fromToken, toToken)

        if (isWrap) {
          const estimate = await estimateWrapGas(amount, address as `0x${string}`)
          setWrapUnwrapGasEstimate(estimate)
        } else if (isUnwrap) {
          const estimate = await estimateUnwrapGas(amount, address as `0x${string}`)
          setWrapUnwrapGasEstimate(estimate)
        }
      } catch (error) {
        console.warn("Failed to estimate wrap/unwrap gas:", error)
        setWrapUnwrapGasEstimate(null)
      }
    }

    // Debounce gas estimation
    const timeoutId = setTimeout(estimateGas, 500)
    return () => clearTimeout(timeoutId)
  }, [isWrapUnwrap, amount, address, isConnected, fromToken, toToken])

  // --- Refresh Timer ---
  useEffect(() => {
    if (isWrapUnwrap || !activeQuote || isSwitching) return
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [activeQuote, isSwitching, isWrapUnwrap])

  useEffect(() => {
    if (timeLeft === 0 && !isQuoteLoading) {
      // 1. Turn off manual mode first
      setIsManualInversion(false)
      setSwappedQuote(null)

      // 2. Use a small timeout or wait for next tick to refetch
      // This ensures the hook sees isManualInversion = false before firing
      setTimeout(() => {
        refetch().then(() => setTimeLeft(15))
      }, 0)
    }
  }, [timeLeft, refetch, isQuoteLoading])

  // --- Explicit Handlers ---
  const handleSwitch = useCallback(() => {
    if (!fromToken || !toToken) return

    // Capture current content to prevent "Select tokens" flash
    setLastValidRate(exchangeRateContent)

    // Prevent rapid switching (minimum 500ms between switches)
    const now = Date.now()
    if (now - lastSwitchTime < 500) return
    setLastSwitchTime(now)

    setIsSwitching(true)

    // 1. CAPTURE CURRENT DATA
    const oldFrom = fromToken
    const oldTo = toToken
    const currentQuote = activeQuote || cachedQuote

    // 2. SWAP TOKENS
    setFromToken(oldTo)
    setToToken(oldFrom)
    setEditingSide("sell") // Always reset to "sell" (Exact In) on a switch

    if (currentQuote) {
      // 3. The amount in the "Buy" box becomes the new "Sell" amount
      const newSellAmount = currentQuote.amountOutFormatted.replace(/,/g, "")
      setAmount(newSellAmount)

      // 4. OPTIMISTIC INVERSION
      const invertedQuote: QuoteResult = {
        ...currentQuote,
        amountIn: currentQuote.amountOut,
        amountInFormatted: currentQuote.amountOutFormatted,
        amountOut: currentQuote.amountIn,
        amountOutFormatted: currentQuote.amountInFormatted,
        exchangeRate: 1 / currentQuote.exchangeRate,
      }

      setSwappedQuote(invertedQuote)
      setIsManualInversion(true)

      // Immediately update the cached rate string with inverted values
      const newRate = (1 / currentQuote.exchangeRate).toFixed(6)
      setLastValidRate(`1 ${oldTo.symbol} = ${newRate} ${oldFrom.symbol}`)
    }

    // Re-enable quoting after switching
    setTimeout(() => {
      setIsSwitching(false)
      // Explicitly calling refetch ensures the "Sell" quote starts now
      refetch()
    }, 100)
  }, [fromToken, toToken, activeQuote, cachedQuote, lastSwitchTime])

  // Helper function to check if quote has changed
  const hasQuoteChanged = (
    currentQuote: QuoteResult | null,
    prevQuote: QuoteResult | null
  ): boolean => {
    if (!currentQuote && !prevQuote) return false
    if (!currentQuote || !prevQuote) return true

    // Compare key fields that indicate a different quote
    return (
      currentQuote.exchangeRate !== prevQuote.exchangeRate ||
      currentQuote.amountOut !== prevQuote.amountOut ||
      currentQuote.amountIn !== prevQuote.amountIn ||
      currentQuote.priceImpact !== prevQuote.priceImpact ||
      currentQuote.gasEstimate !== prevQuote.gasEstimate ||
      currentQuote.fee !== prevQuote.fee
    )
  }

  const exchangeRateContent = useMemo(() => {
    // If quote hasn't changed, return the previous content to avoid unnecessary updates
    if (
      displayQuote &&
      prevQuoteRef.current &&
      !hasQuoteChanged(displayQuote, prevQuoteRef.current)
    ) {
      return prevExchangeRateContentRef.current || "Select tokens"
    }

    // Update refs with current quote
    prevQuoteRef.current = displayQuote
    let newContent: string

    if (isQuoteLoading && !isManualInversion) {
      newContent = "Fetching rate..."
    } else if (isWrapUnwrap) {
      newContent = `1 ${fromToken?.symbol} = 1 ${toToken?.symbol}`
    } else if (hasNoLiquidity) {
      newContent = "No liquidity"
    } else if (displayQuote && fromToken && toToken) {
      // Use displayQuote for consistency
      const rate = displayQuote.exchangeRate.toFixed(6)
      newContent = `1 ${fromToken.symbol} = ${rate} ${toToken.symbol}`
    } else if (isSwitching || isManualInversion) {
      // FALLBACK: If we are switching, the old rate is still better than "Select tokens"
      newContent = lastValidRate || "Select tokens"
    } else {
      newContent = "Select tokens"
    }

    // Store the new content for next comparison
    prevExchangeRateContentRef.current = newContent
    return newContent
  }, [
    isQuoteLoading,
    isManualInversion,
    isWrapUnwrap,
    fromToken?.symbol,
    toToken?.symbol,
    displayQuote,
    hasNoLiquidity,
    isSwitching,
    lastValidRate,
  ])

  // --- Balance Refresh Function ---
  const refreshBalances = useCallback(async () => {
    try {
      await Promise.all([refetchFromBalance(), refetchToBalance()])
    } catch (err) {
      console.error("Failed to refresh balances:", err)
    }
  }, [refetchFromBalance, refetchToBalance])

  return {
    // State
    fromToken,
    setFromToken,
    toToken,
    setToToken,
    amount,
    setAmount,
    editingSide,
    setEditingSide,

    // Actions
    handleSwitch,
    setIsManualInversion,
    setSwappedQuote,
    refreshBalances,

    // Settings Persistence
    ...settings,

    // Market/Balance Data
    fromPrice: cachedFromPrice,
    isLoadingFromPrice,
    toPrice: cachedToPrice,
    isLoadingToPrice,
    fromBalance,
    fromBalanceValue,
    isLoadingFromBalance,
    toBalance,
    toBalanceValue,
    isLoadingToBalance,

    // Quote Info
    activeQuote,
    displayQuote,
    isQuoteLoading,
    quoteError,
    timeLeft,
    exchangeRateContent,
    isWrapUnwrap,
    calculatedAutoSlippage,
    isManualInversion,
    hasNoLiquidity,
    gasEstimate: isWrapUnwrap ? wrapUnwrapGasEstimate : (displayQuote?.gasEstimate ?? null),

    // Wrap Logic
    ...wrapContext,
  }
}
