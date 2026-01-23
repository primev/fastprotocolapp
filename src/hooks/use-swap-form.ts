"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useAccount, useBalance } from "wagmi"
import { formatUnits } from "viem"
import { useQuote, calculateAutoSlippage, type QuoteResult } from "@/hooks/use-quote-v2"
import { useTokenPrice } from "@/hooks/use-token-price"
import { useGasPrice } from "@/hooks/use-gas-price"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { isWrapUnwrapPair } from "@/lib/weth-utils"
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

  // --- Market Data ---
  const { price: fromPrice, isLoading: isLoadingFromPrice } = useTokenPrice(fromToken?.symbol || "")
  const { price: toPrice, isLoading: isLoadingToPrice } = useTokenPrice(toToken?.symbol || "")
  const { gasPriceGwei } = useGasPrice()

  // --- Balances ---
  const { data: fromBalance, isLoading: isLoadingFromBalance } = useBalance({
    address: isConnected ? address : undefined,
    token: fromToken?.address !== ZERO_ADDRESS ? (fromToken?.address as `0x${string}`) : undefined,
  })
  const { data: toBalance, isLoading: isLoadingToBalance } = useBalance({
    address: isConnected ? address : undefined,
    token: toToken?.address !== ZERO_ADDRESS ? (toToken?.address as `0x${string}`) : undefined,
  })

  const fromBalanceValue =
    fromBalance && fromToken ? parseFloat(formatUnits(fromBalance.value, fromToken.decimals)) : 0
  const toBalanceValue =
    toBalance && toToken ? parseFloat(formatUnits(toBalance.value, toToken.decimals)) : 0

  // --- Swap / Wrap Logic Detection ---
  const isWrapUnwrap = isWrapUnwrapPair(fromToken, toToken)

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
    tradeType: editingSide === "sell" ? "exactIn" : "exactOut",
    tokenList: allTokens,
    enabled: !isSwitching && !!amount && !!fromToken && !!toToken && !isWrapUnwrap,
  })

  const activeQuote = isManualInversion ? swappedQuote : quote

  // Handle no liquidity case
  const hasNoLiquidity =
    noLiquidity || (quoteError && quoteError.message?.includes("No liquidity found"))
  const displayQuote = hasNoLiquidity ? null : activeQuote

  // --- WETH Wrap Context ---
  const wrapContext = useWethWrapUnwrap({
    fromToken,
    toToken,
    amount,
    enabled: isWrapUnwrap && !!amount,
  })

  // --- Refresh Timer ---
  useEffect(() => {
    if (isWrapUnwrap || !activeQuote || isSwitching) return
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [activeQuote, isSwitching, isWrapUnwrap])

  useEffect(() => {
    if (timeLeft === 0 && !isQuoteLoading) {
      setIsManualInversion(false)
      refetch().then(() => setTimeLeft(15))
    }
  }, [timeLeft, refetch, isQuoteLoading])

  // --- Explicit Handlers ---
  const handleSwitch = useCallback(() => {
    if (!fromToken || !toToken) return

    // Prevent rapid switching (minimum 500ms between switches)
    const now = Date.now()
    if (now - lastSwitchTime < 500) return
    setLastSwitchTime(now)

    setIsSwitching(true)
    setIsManualInversion(false) // Don't use manual inversion
    setSwappedQuote(null) // Clear any previous swapped quote

    // Use the current quote's output amount if available, otherwise keep the current amount
    const newAmount = activeQuote ? activeQuote.amountOutFormatted.replace(/,/g, "") : amount

    setFromToken(toToken)
    setToToken(fromToken)
    setAmount(newAmount)

    // Re-enable quoting after switching
    setTimeout(() => {
      setIsSwitching(false)
    }, 100)
  }, [fromToken, toToken, activeQuote, amount, lastSwitchTime])

  const exchangeRateContent = useMemo(() => {
    if (isQuoteLoading && !isManualInversion) return "Fetching rate..."
    if (isWrapUnwrap) return `1 ${fromToken?.symbol} = 1 ${toToken?.symbol}`
    if (hasNoLiquidity) return "No liquidity"
    if (displayQuote)
      return `1 ${fromToken?.symbol} = ${displayQuote.exchangeRate.toFixed(6)} ${toToken?.symbol}`
    return "Select tokens"
  }, [
    isQuoteLoading,
    isManualInversion,
    isWrapUnwrap,
    fromToken,
    toToken,
    displayQuote,
    hasNoLiquidity,
  ])

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

    // Settings Persistence
    ...settings,

    // Market/Balance Data
    fromPrice,
    isLoadingFromPrice,
    toPrice,
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

    // Wrap Logic
    ...wrapContext,
  }
}
