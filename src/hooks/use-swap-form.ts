"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useAccount, useBalance, useChainId, useWatchBlockNumber } from "wagmi"
import { formatUnits } from "viem"
import { useQueryClient } from "@tanstack/react-query"
import { useQuote, type QuoteResult } from "@/hooks/use-swap-quote"
import { useTokenPrice } from "@/hooks/use-token-price"
import { useBroadcastGasPrice } from "@/hooks/use-broadcast-gas-price"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { usePermit2Allowance } from "@/hooks/use-permit2-allowance"
import {
  isWrapUnwrapPair,
  isWrapOperation,
  isUnwrapOperation,
  estimateWrapGas,
  estimateUnwrapGas,
} from "@/lib/weth-utils"
import { ZERO_ADDRESS } from "@/lib/swap-constants"
import { isStablecoin } from "@/lib/stablecoins"
import { formatAmountByTokenType } from "@/lib/utils"
import { useSwapSlippage } from "@/hooks/use-swap-slippage"
import { useBarterValidation } from "@/hooks/use-barter-validation"
import { usePageActive } from "@/hooks/use-page-active"
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
  const settings = useSwapSlippage()

  // --- Core State ---
  const [fromToken, setFromToken] = useState<Token | undefined>(DEFAULT_ETH_TOKEN)
  const [toToken, setToToken] = useState<Token | undefined>(undefined)
  const [amount, setAmount] = useState("")
  const [editingSide, setEditingSide] = useState<"sell" | "buy">("sell")
  const [clearSwapState, setClearSwapState] = useState(false)

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

  const isPageActive = usePageActive()
  const prevConnectedRef = useRef<boolean | undefined>(undefined)
  const lastValidQuotePairKeyRef = useRef<string>("")

  // --- Market Data ---
  const { price: fromPrice, isLoading: isLoadingFromPrice } = useTokenPrice(fromToken?.symbol || "")
  const { price: toPrice, isLoading: isLoadingToPrice } = useTokenPrice(toToken?.symbol || "")
  const { price: ethPrice } = useTokenPrice("ETH")
  const { gasPriceGwei } = useBroadcastGasPrice()

  // --- BALANCES LOGIC ---

  const refreshBalances = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["balance", { address, chainId }],
    })
  }, [address, chainId, queryClient])

  const resetFormAfterSuccess = useCallback(() => {
    setAmount("")
    setSwappedQuote(null)
    setTimeLeft(15)
    setIsManualInversion(false)
    setLastValidRate(null)
    // Clear quote cache for current pair so displayQuote doesn't show stale swap data
    setQuoteCache((prev) => {
      const pairKey = `${fromToken?.symbol || ""}-${toToken?.symbol || ""}`
      const next = { ...prev }
      delete next[pairKey]
      return next
    })
  }, [fromToken, toToken])

  // Watch for new blocks and refetch connected wallet balances so the UI updates automatically
  useWatchBlockNumber({
    chainId,
    enabled: isConnected && Boolean(address),
    onBlockNumber() {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[1] as { address?: string } | undefined
          return query.queryKey[0] === "balance" && key?.address === address
        },
      })
    },
  })

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

  // Reset all form state when wallet disconnects (connected → disconnected only)
  useEffect(() => {
    const wasConnected = prevConnectedRef.current
    prevConnectedRef.current = isConnected
    if (wasConnected === true && !isConnected) {
      setFromToken(DEFAULT_ETH_TOKEN)
      setToToken(undefined)
      setAmount("")
      setEditingSide("sell")
      setIsManualInversion(false)
      setSwappedQuote(null)
      setIsSwitching(false)
      setTimeLeft(15)
      setLastSwitchTime(0)
      setPriceCache({})
      setQuoteCache({})
      setLastValidRate(null)
      setWrapUnwrapGasEstimate(null)
    }
  }, [isConnected, clearSwapState])

  // --- Quote Logic ---
  const isWrapUnwrap = isWrapUnwrapPair(fromToken, toToken)
  const pairKey = `${fromToken?.symbol || ""}-${toToken?.symbol || ""}`

  // Clear cache and manual inversion state when tokens change
  // This prevents showing stale cached quotes from previous token pairs
  const prevPairKeyRef = useRef<string>(pairKey)
  const prevIsWrapUnwrapRef = useRef<boolean>(isWrapUnwrap)
  useEffect(() => {
    const pairChanged = prevPairKeyRef.current !== pairKey
    const wrapUnwrapChanged = prevIsWrapUnwrapRef.current !== isWrapUnwrap

    if (pairChanged || wrapUnwrapChanged) {
      // Tokens changed or wrap/unwrap state changed - clear manual inversion state and swapped quote
      setIsManualInversion(false)
      setSwappedQuote(null)

      // Clear cache entries to prevent stale data
      if (pairChanged && prevPairKeyRef.current) {
        // Clear the old pair's cache
        setQuoteCache((prev) => {
          const newCache = { ...prev }
          delete newCache[prevPairKeyRef.current]
          return newCache
        })
      }

      // If transitioning to wrap/unwrap, also clear cache for the new pair
      // since wrap/unwrap doesn't use quotes and shouldn't show cached values
      if (isWrapUnwrap && pairKey) {
        setQuoteCache((prev) => {
          const newCache = { ...prev }
          delete newCache[pairKey]
          return newCache
        })
      }

      prevPairKeyRef.current = pairKey
      prevIsWrapUnwrapRef.current = isWrapUnwrap
    }
  }, [pairKey, isWrapUnwrap])

  const effectiveSlippage = settings.slippage

  const quoteEnabled = !isSwitching && !!amount && !!fromToken && !!toToken && !isWrapUnwrap

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
    tradeType: editingSide === "buy" ? "exactOut" : "exactIn",
    tokenList: allTokens,
    enabled: quoteEnabled,
  })

  // Keep lastValidQuotePairKeyRef in sync so the activeQuote memo can read it synchronously.
  // Also bump quoteGeneration so Barter re-validates on every requote, even if amountOut is unchanged.
  const [quoteGeneration, setQuoteGeneration] = useState(0)
  useEffect(() => {
    if (quote && !isQuoteLoading) {
      lastValidQuotePairKeyRef.current = pairKey
      setQuoteGeneration((g) => g + 1)
    }
  }, [quote, isQuoteLoading, pairKey])

  const activeQuote = useMemo(() => {
    if (isManualInversion && swappedQuote) return swappedQuote
    if (quote && !isQuoteLoading) return quote
    // During a periodic refresh of the same pair (15s timer), keep the last quote so the buy
    // amount, swap button, price impact, and USD values don't flicker to empty/zero states.
    // When tokens change, pairKey differs → we fall through and return null as before.
    if (isQuoteLoading && quote && lastValidQuotePairKeyRef.current === pairKey) return quote
    return null
  }, [isManualInversion, swappedQuote, quote, isQuoteLoading, pairKey])

  // Don't use cached quotes for wrap/unwrap pairs - they don't have quotes
  // Also ensure we only use cache if it matches the current pair (defensive check)
  const displayQuote = activeQuote || (!isWrapUnwrap ? quoteCache[pairKey] : null)

  useEffect(() => {
    if (quote && fromToken?.symbol && toToken?.symbol && !isManualInversion) {
      setQuoteCache((prev) => ({ ...prev, [pairKey]: quote }))
    }
  }, [quote, fromToken?.symbol, toToken?.symbol, isManualInversion, pairKey])

  const hasNoLiquidity = useMemo(() => {
    if (isManualInversion && swappedQuote) return false
    return noLiquidity || (quoteError && quoteError.message?.includes("No liquidity found"))
  }, [noLiquidity, quoteError, isManualInversion, swappedQuote])

  // Compute minAmountOut inline from current slippage + amountOut.
  // Intentionally NOT derived from displayQuote.slippageLimit, which is updated inside a
  // useEffect in useQuote and lags one render cycle behind slippage changes. Computing here
  // ensures the value is always in sync with effectiveSlippage (e.g. after a retry).
  //
  // Slippage is applied to the output for BOTH exactIn and exactOut. For exactOut the
  // barter API still treats userAmtOut as a minimum return, so it must have slippage applied
  // or the swap will always fail when barter's price deviates from the Uniswap quote.
  const computedMinAmountOut = useMemo(() => {
    if (isWrapUnwrap || !displayQuote || !toToken) return null
    const slippageBps = BigInt(Math.floor(parseFloat(effectiveSlippage || "0") * 100))
    const limit = (displayQuote.amountOut * (10000n - slippageBps)) / 10000n
    return formatUnits(limit, toToken.decimals)
  }, [isWrapUnwrap, displayQuote, toToken, effectiveSlippage])

  // Validate Barter can route this amount within 2% slippage.
  // Skip when user has insufficient balance — no point quoting an unexecutable swap.
  const hasSufficientBalance =
    fromBalanceValue > 0 && parseFloat(amount?.replace(/,/g, "") || "0") <= fromBalanceValue
  const { amountTooSmall: barterAmountTooSmall, isValidating: isBarterValidating } =
    useBarterValidation({
      fromToken,
      toToken,
      amountOut: displayQuote?.amountOut,
      sellAmount: amount,
      quoteGeneration,
      enabled: !isWrapUnwrap && !!displayQuote && hasSufficientBalance,
    })

  // --- Minimum "Calculating..." display time ---
  // The combined validating signal (quote loading OR barter validating) must stay true
  // for at least 1.5s to prevent the swap button text from flickering.
  const MIN_VALIDATING_DISPLAY_MS = 1500
  const rawValidating = isBarterValidating || (isQuoteLoading && !isWrapUnwrap)
  const [debouncedValidating, setDebouncedValidating] = useState(false)
  const validatingSinceRef = useRef<number>(0)
  const minDisplayTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (rawValidating) {
      // Going true — show immediately, record timestamp
      clearTimeout(minDisplayTimerRef.current)
      setDebouncedValidating(true)
      validatingSinceRef.current = Date.now()
    } else if (debouncedValidating) {
      // Going false — delay until minimum display time has elapsed
      const elapsed = Date.now() - validatingSinceRef.current
      const remaining = MIN_VALIDATING_DISPLAY_MS - elapsed
      if (remaining > 0) {
        minDisplayTimerRef.current = setTimeout(() => setDebouncedValidating(false), remaining)
      } else {
        setDebouncedValidating(false)
      }
    }
    return () => clearTimeout(minDisplayTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawValidating])

  // --- UI Content Generation ---

  // Declared BEFORE handleSwitch to fix hoisting error
  const exchangeRateContent = useMemo(() => {
    if (isWrapUnwrap) return `1 ${fromToken?.symbol} = 1 ${toToken?.symbol}`
    if (!displayQuote && fromToken && toToken) return null
    if (displayQuote && fromToken && toToken) {
      const isToStable = isStablecoin(toToken.address ?? "", toToken.symbol)
      // Rate is "toToken per 1 fromToken", so format using toToken's type (avoid 0.00 for small rates like 1 USDT = 0.000356 ETH)
      const rate = displayQuote.exchangeRate
      const rateFormatted = isToStable
        ? rate.toFixed(2)
        : rate.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
      return `1 ${fromToken.symbol} = ${rateFormatted} ${toToken.symbol}`
    }
    return lastValidRate || "-"
  }, [isWrapUnwrap, fromToken, toToken, displayQuote, lastValidRate])

  // Numeric rate for NumberFlow (subtle animation on refetch; no "Fetching rate..." text)
  const exchangeRateValue = displayQuote && fromToken && toToken ? displayQuote.exchangeRate : null
  const exchangeRateFromSymbol = fromToken?.symbol ?? ""
  const exchangeRateToSymbol = toToken?.symbol ?? ""
  const exchangeRateToStable = toToken ? isStablecoin(toToken.address ?? "", toToken.symbol) : false

  const handleSwitch = useCallback(() => {
    if (!fromToken || !toToken) return
    setLastValidRate(exchangeRateContent)

    const now = Date.now()
    if (now - lastSwitchTime < 500) return
    setLastSwitchTime(now)

    setIsSwitching(true)
    const oldFrom = fromToken
    const oldTo = toToken

    setFromToken(oldTo)
    setToToken(oldFrom)
    setEditingSide("sell")

    // For wrap/unwrap pairs, keep the current amount (1:1 ratio) and don't use cached quotes
    // Wrap/unwrap doesn't have quotes, so we should never use cached quote data for them
    if (isWrapUnwrap) {
      // Keep current amount (wrap/unwrap is 1:1)
      // Clear any manual inversion state since we're not using quotes
      setIsManualInversion(false)
      setSwappedQuote(null)
    } else if (activeQuote) {
      // Use activeQuote which matches the current amount
      setAmount(activeQuote.amountOutFormatted.replace(/,/g, ""))
      setSwappedQuote({
        ...activeQuote,
        amountIn: activeQuote.amountOut,
        amountInFormatted: activeQuote.amountOutFormatted,
        amountOut: activeQuote.amountIn,
        amountOutFormatted: activeQuote.amountInFormatted,
        exchangeRate: 1 / activeQuote.exchangeRate,
      })
      setIsManualInversion(true)
    } else {
      // Fall back to cached quote only if it matches the current amount
      // Only use cache for non-wrap/unwrap pairs
      const cachedQuote = quoteCache[pairKey]
      if (cachedQuote && amount) {
        const cachedInputAmount = cachedQuote.amountInFormatted.replace(/,/g, "")
        const currentInputAmount = amount.replace(/,/g, "")

        // Only use cached quote if it matches the current amount
        if (cachedInputAmount === currentInputAmount) {
          setAmount(cachedQuote.amountOutFormatted.replace(/,/g, ""))
          setSwappedQuote({
            ...cachedQuote,
            amountIn: cachedQuote.amountOut,
            amountInFormatted: cachedQuote.amountOutFormatted,
            amountOut: cachedQuote.amountIn,
            amountOutFormatted: cachedQuote.amountInFormatted,
            exchangeRate: 1 / cachedQuote.exchangeRate,
          })
          setIsManualInversion(true)
        }
        // If cache doesn't match current amount, keep current amount and let refetch handle it
      }
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
    amount,
    isWrapUnwrap,
  ])

  // --- WETH Context & Gas ---
  const wrapContext = useWethWrapUnwrap({ fromToken, toToken, amount })

  // --- Permit2 Approval (Permit path only) ---
  const isPermitPath =
    !isWrapUnwrap && !!fromToken && fromToken.address?.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
  const permit2Amount =
    editingSide === "buy" ? displayQuote?.amountInFormatted?.replace(/,/g, "") || "" : amount
  const permit2Allowance = usePermit2Allowance({
    token: fromToken,
    owner: address as `0x${string}` | undefined,
    amount: permit2Amount,
    enabled: isPermitPath && isConnected && !!address,
  })

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

  // --- Refresh Timer (pauses when tab hidden or user idle) ---
  useEffect(() => {
    if (isWrapUnwrap || !activeQuote || isSwitching || !isPageActive) return
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [activeQuote, isSwitching, isWrapUnwrap, isPageActive])

  // When user returns from inactive state, refetch immediately
  const wasActiveRef = useRef(isPageActive)
  useEffect(() => {
    const wasActive = wasActiveRef.current
    wasActiveRef.current = isPageActive

    if (isPageActive && !wasActive && activeQuote && !isWrapUnwrap) {
      setIsManualInversion(false)
      setSwappedQuote(null)
      refetch().then(() => setTimeLeft(15))
    }
  }, [isPageActive, activeQuote, isWrapUnwrap, refetch])

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
    resetFormAfterSuccess,
    ...settings,
    slippage: effectiveSlippage,
    fromPrice: priceCache[fromToken?.symbol || ""] ?? fromPrice ?? 0,
    toPrice: priceCache[toToken?.symbol || ""] ?? toPrice ?? 0,
    isLoadingFromPrice,
    isLoadingToPrice,
    fromBalance,
    fromBalanceValue,
    isLoadingFromBalance,
    toBalance,
    toBalanceValue,
    isLoadingToBalance,
    activeQuote,
    displayQuote,
    computedMinAmountOut,
    isQuoteLoading,
    quoteError,
    refetchQuote: refetch,
    timeLeft,
    exchangeRateContent,
    exchangeRateValue,
    exchangeRateFromSymbol,
    exchangeRateToSymbol,
    exchangeRateToStable,
    isWrapUnwrap,
    isManualInversion,
    setIsManualInversion,
    swappedQuote,
    setSwappedQuote,
    hasNoLiquidity,
    barterAmountTooSmall,
    isBarterValidating: debouncedValidating,
    gasEstimate: isWrapUnwrap ? wrapUnwrapGasEstimate : (displayQuote?.gasEstimate ?? null),
    ethPrice: ethPrice ?? null,
    setClearSwapState,
    ...wrapContext,
    // Permit2 approval state (Permit path only)
    isPermitPath,
    needsPermit2Approval: isPermitPath ? permit2Allowance.needsApproval : false,
    isApproving: isPermitPath ? permit2Allowance.isApproving : false,
    isApprovalRejected: isPermitPath ? permit2Allowance.isApprovalRejected : false,
    approvalTxHash: isPermitPath ? permit2Allowance.approvalTxHash : undefined,
    approvePermit2: permit2Allowance.approve,
    isApprovalLoading: isPermitPath ? permit2Allowance.isLoading : false,
    approveTokenSymbol: fromToken?.symbol,
  }
}
