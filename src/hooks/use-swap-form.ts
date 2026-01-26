"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useAccount, useBalance, useChainId } from "wagmi"
import { formatUnits } from "viem"
import { useQueryClient } from "@tanstack/react-query"
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
 * useSwapForm - Logic engine for the Swap UI.
 * Optimized to use Wagmi's internal TanStack cache and prioritize Alchemy for reads.
 */
export function useSwapForm(allTokens: Token[]) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const queryClient = useQueryClient()
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
  const [quoteCache, setQuoteCache] = useState<Record<string, QuoteResult>>({})
  const [lastValidRate, setLastValidRate] = useState<string | null>(null)
  const [wrapUnwrapGasEstimate, setWrapUnwrapGasEstimate] = useState<bigint | null>(null)

  // --- Market Data ---
  const { price: fromPrice, isLoading: isLoadingFromPrice } = useTokenPrice(fromToken?.symbol || "")
  const { price: toPrice, isLoading: isLoadingToPrice } = useTokenPrice(toToken?.symbol || "")
  const { gasPriceGwei } = useGasPrice()

  // --- BALANCES LOGIC ---

  const refreshBalances = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["balance", { address, chainId }],
    })
  }, [address, chainId, queryClient])

  const { data: fromBalance, isLoading: isLoadingFromBalance } = useBalance({
    address: isConnected ? address : undefined,
    token: fromToken?.address !== ZERO_ADDRESS ? (fromToken?.address as `0x${string}`) : undefined,
    chainId,
  })

  const { data: toBalance, isLoading: isLoadingToBalance } = useBalance({
    address: isConnected ? address : undefined,
    token: toToken?.address !== ZERO_ADDRESS ? (toToken?.address as `0x${string}`) : undefined,
    chainId,
  })

  const fromBalanceValue = useMemo(
    () => (fromBalance ? parseFloat(formatUnits(fromBalance.value, fromToken?.decimals || 18)) : 0),
    [fromBalance, fromToken]
  )

  const toBalanceValue = useMemo(
    () => (toBalance ? parseFloat(formatUnits(toBalance.value, toToken?.decimals || 18)) : 0),
    [toBalance, toToken]
  )

  useEffect(() => {
    if (isConnected && address) refreshBalances()
  }, [address, isConnected, refreshBalances])

  // --- Quote Logic ---
  const isWrapUnwrap = isWrapUnwrapPair(fromToken, toToken)
  const pairKey = `${fromToken?.symbol || ""}-${toToken?.symbol || ""}`

  const calculatedAutoSlippage = useMemo(() => {
    if (!settings.isAutoSlippage || !amount || !fromToken || !toToken) return null
    return calculateAutoSlippage(parseFloat(amount), fromToken, toToken, gasPriceGwei)
  }, [settings.isAutoSlippage, amount, fromToken, toToken, gasPriceGwei])

  const effectiveSlippage =
    settings.isAutoSlippage && calculatedAutoSlippage
      ? calculatedAutoSlippage.toFixed(2)
      : settings.slippage

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

  const activeQuote = useMemo(() => {
    if (quote && !isQuoteLoading) return quote
    if (isManualInversion && swappedQuote) return swappedQuote
    return null
  }, [isManualInversion, swappedQuote, quote, isQuoteLoading])

  const displayQuote = activeQuote || quoteCache[pairKey]

  useEffect(() => {
    if (quote && fromToken?.symbol && toToken?.symbol && !isManualInversion) {
      setQuoteCache((prev) => ({ ...prev, [pairKey]: quote }))
    }
  }, [quote, fromToken?.symbol, toToken?.symbol, isManualInversion, pairKey])

  const hasNoLiquidity = useMemo(() => {
    if (isManualInversion && swappedQuote) return false
    return noLiquidity || (quoteError && quoteError.message?.includes("No liquidity found"))
  }, [noLiquidity, quoteError, isManualInversion, swappedQuote])

  // --- UI Content Generation ---

  // Declared BEFORE handleSwitch to fix hoisting error
  const exchangeRateContent = useMemo(() => {
    if (isQuoteLoading && !isManualInversion) return "Fetching rate..."
    if (isWrapUnwrap) return `1 ${fromToken?.symbol} = 1 ${toToken?.symbol}`
    if (hasNoLiquidity) return "No liquidity"
    if (displayQuote && fromToken && toToken) {
      return `1 ${fromToken.symbol} = ${displayQuote.exchangeRate.toFixed(6)} ${toToken.symbol}`
    }
    return lastValidRate || "Select tokens"
  }, [
    isQuoteLoading,
    isManualInversion,
    isWrapUnwrap,
    fromToken,
    toToken,
    displayQuote,
    hasNoLiquidity,
    lastValidRate,
  ])

  const handleSwitch = useCallback(() => {
    if (!fromToken || !toToken) return
    setLastValidRate(exchangeRateContent)

    const now = Date.now()
    if (now - lastSwitchTime < 500) return
    setLastSwitchTime(now)

    setIsSwitching(true)
    const oldFrom = fromToken
    const oldTo = toToken
    const currentQuote = activeQuote || quoteCache[pairKey]

    setFromToken(oldTo)
    setToToken(oldFrom)
    setEditingSide("sell")

    if (currentQuote) {
      setAmount(currentQuote.amountOutFormatted.replace(/,/g, ""))
      setSwappedQuote({
        ...currentQuote,
        amountIn: currentQuote.amountOut,
        amountInFormatted: currentQuote.amountOutFormatted,
        amountOut: currentQuote.amountIn,
        amountOutFormatted: currentQuote.amountInFormatted,
        exchangeRate: 1 / currentQuote.exchangeRate,
      })
      setIsManualInversion(true)
    }

    setTimeout(() => {
      setIsSwitching(false)
      refetch()
    }, 100)
  }, [
    fromToken,
    toToken,
    activeQuote,
    quoteCache,
    pairKey,
    lastSwitchTime,
    exchangeRateContent,
    refetch,
  ])

  // --- WETH Context & Gas ---
  const wrapContext = useWethWrapUnwrap({ fromToken, toToken, amount })

  useEffect(() => {
    if (!isWrapUnwrap || !amount || !address || !isConnected) {
      setWrapUnwrapGasEstimate(null)
      return
    }
    const estimate = async () => {
      try {
        const est = isWrapOperation(fromToken, toToken)
          ? await estimateWrapGas(amount, address as `0x${string}`)
          : await estimateUnwrapGas(amount, address as `0x${string}`)
        setWrapUnwrapGasEstimate(est)
      } catch {
        setWrapUnwrapGasEstimate(null)
      }
    }
    const tid = setTimeout(estimate, 500)
    return () => clearTimeout(tid)
  }, [isWrapUnwrap, amount, address, isConnected, fromToken, toToken])

  // --- Refresh Timer ---
  useEffect(() => {
    if (isWrapUnwrap || !activeQuote || isSwitching) return
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [activeQuote, isSwitching, isWrapUnwrap])

  useEffect(() => {
    if (timeLeft === 0 && !isQuoteLoading) {
      setIsManualInversion(false)
      setSwappedQuote(null)
      setTimeout(() => {
        refetch().then(() => setTimeLeft(15))
      }, 0)
    }
  }, [timeLeft, refetch, isQuoteLoading])

  return {
    fromToken,
    setFromToken,
    toToken,
    setToToken,
    amount,
    setAmount,
    editingSide,
    setEditingSide,
    handleSwitch,
    refreshBalances,
    ...settings,
    fromPrice: priceCache[fromToken?.symbol || ""] ?? fromPrice ?? 0,
    toPrice: priceCache[toToken?.symbol || ""] ?? toPrice ?? 0,
    fromBalance,
    fromBalanceValue,
    isLoadingFromBalance,
    toBalance,
    toBalanceValue,
    isLoadingToBalance,
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
    ...wrapContext,
  }
}
