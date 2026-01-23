"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react"
import { useAccount, useBalance } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { formatUnits } from "viem"
import { cn, formatBalance } from "@/lib/utils"
import {
  isTransactionRejection,
  getTransactionRejectionMessage,
  getTransactionErrorMessage,
  getTransactionErrorTitle,
} from "@/lib/transaction-errors"
import TokenSelector from "./TokenSelector"
import SwapReview from "./SwapReview"
import SwapDock from "./SwapDock"
import TokenSwapSection from "./TokenSwapSection"
import SwitchButton from "./SwitchButton-old"
import SwapActionButton from "./SwapActionButton"
import QuoteErrorDisplay from "./QuoteErrorDisplay"
import { useTokenSwitch } from "@/hooks/use-token-switch"
import {
  useQuote,
  getPriceImpactSeverity,
  calculateAutoSlippage,
  type QuoteResult,
} from "@/hooks/use-quote-v2"
import { useToast } from "@/hooks/use-toast"
import { useTokenPrice } from "@/hooks/use-token-price"
import { useSwapConfirmation } from "@/hooks/use-swap-confirmation"
import { useGasPrice } from "@/hooks/use-gas-price"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { isWrapUnwrapPair } from "@/lib/weth-utils"
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
  const [isAutoSlippage, setIsAutoSlippage] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("swapSlippageAuto") === "true"
    }
    return false
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

  const handleAutoSlippageChange = (isAuto: boolean) => {
    setIsAutoSlippage(isAuto)
    localStorage.setItem("swapSlippageAuto", isAuto.toString())
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
  const hasEverStartedRef = useRef(false)
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
  // Only show errors if a transaction was actually attempted (not just validation errors)
  useEffect(() => {
    if (wrapUnwrapError && (wrapUnwrapHash || isWrapUnwrapPending || isWrapUnwrapConfirming)) {
      const operation = isWrap ? "wrap" : isUnwrap ? "unwrap" : "transaction"

      toast({
        title: getTransactionErrorTitle(wrapUnwrapError, operation),
        description: getTransactionErrorMessage(wrapUnwrapError, operation),
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

  // Debug wrap/unwrap errors
  useEffect(() => {
    if (wrapUnwrapError) {
      console.log("Wrap/unwrap error detected:", wrapUnwrapError)
      console.log("Error type:", wrapUnwrapError.constructor.name)
      console.log("Error message:", wrapUnwrapError.message)
      console.log("Error details:", wrapUnwrapError)
    }
  }, [wrapUnwrapError])

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

  const [timeLeft, setTimeLeft] = useState(15)
  const [pulseKey, setPulseKey] = useState(0)
  const [pulseAnimationKey, setPulseAnimationKey] = useState(0)
  const hasRefetchedRef = useRef(false)
  const justSwitchedSamePairRef = useRef(false)
  const sellInputRef = useRef<HTMLInputElement>(null)
  const buyInputRef = useRef<HTMLInputElement>(null)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [editingSide, setEditingSide] = useState<"sell" | "buy">("sell")
  const [isSwitching, setIsSwitching] = useState(false)
  const [preservedDisplayQuote, setPreservedDisplayQuote] = useState<string | null>(null)
  const [swappedQuote, setSwappedQuote] = useState<QuoteResult | null>(null)
  const [swappedFromTokenPrice, setSwappedFromTokenPrice] = useState<number | null>(null)
  const [swappedToTokenPrice, setSwappedToTokenPrice] = useState<number | null>(null)

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

  // Store refetch in a ref so timer always has latest version
  const refetchRef = useRef(refetch)

  // Keep refetch ref up to date whenever refetch changes
  useEffect(() => {
    refetchRef.current = refetch
  }, [refetch])

  // Use swapped quote if available (for same-token-pair switches), otherwise use fetched quote
  const activeQuote = swappedQuote || quote

  // Use swapped prices if available (for same-token-pair switches), otherwise use fetched prices
  const activeFromTokenPrice =
    swappedFromTokenPrice !== null ? swappedFromTokenPrice : fromTokenPrice
  const activeToTokenPrice = swappedToTokenPrice !== null ? swappedToTokenPrice : toTokenPrice

  const handleFromTokenSelect = useCallback(
    (token: Token | undefined) => {
      // Only clear amount if invalid pair (same token for both sides)
      if (token?.address === toToken?.address) {
        // Invalid pair: same token for both from and to
        setAmount("")
        setEditingSide("sell")
        setFromToken(token)
        return
      }
      // If token is undefined (clearing selection), also clear amount
      if (!token) {
        setAmount("")
        setFromToken(token)
        return
      }

      // When editing buy side and changing fromToken:
      // - amount is in toToken units (correct for exactOut calculation)
      // - We're changing the input token, so the quote needs to recalculate
      // - The amount should stay the same (it's the desired output)
      // When editing sell side and changing fromToken:
      // - amount is in fromToken units (correct for exactIn calculation)
      // - We're changing the input token, so we should preserve amount
      // In both cases, preserve amount and let quote recalculate
      // But we need to ensure the quote hook recalculates with the new token
      const oldFromToken = fromToken
      setFromToken(token)

      // If the token actually changed, ensure immediate quote fetch and timer restart
      if (oldFromToken?.address !== token.address) {
        // Reset timer immediately when token changes
        setTimeLeft(15)
        hasRefetchedRef.current = false

        // The quote hook will automatically recalculate when fromToken changes
        // because it's in the inputKey dependencies, but we ensure it happens immediately
      }
    },
    [toToken, editingSide, fromToken]
  )

  const handleToTokenSelect = useCallback(
    (token: Token | undefined) => {
      // Only clear amount if invalid pair (same token for both sides)
      if (token?.address === fromToken?.address) {
        // Invalid pair: same token for both from and to
        setAmount("")
        setEditingSide("sell")
        setToToken(token)
        return
      }
      // If token is undefined (clearing selection), also clear amount
      if (!token) {
        setAmount("")
        setToToken(token)
        return
      }

      // When editing buy side and changing toToken:
      // - amount is in toToken units (the desired output)
      // - We're changing the output token, so amount needs to stay the same
      // When editing sell side and changing toToken:
      // - amount is in fromToken units (correct for exactIn calculation)
      // - We're changing the output token, amount stays the same
      // In both cases, preserve amount and let quote recalculate
      const oldToToken = toToken
      setToToken(token)

      // If the token actually changed, ensure immediate quote fetch and timer restart
      if (oldToToken?.address !== token.address) {
        // Reset timer immediately when token changes
        setTimeLeft(15)
        hasRefetchedRef.current = false

        // The quote hook will automatically recalculate when toToken changes
        // because it's in the inputKey dependencies, but we ensure it happens immediately
      }
    },
    [fromToken, editingSide, toToken]
  )

  // Clear quote when tokens change to prevent stale data
  // Also track for insufficientBalance reset
  const prevFromTokenRef = useRef<Token | undefined>(fromToken)
  const prevToTokenRef = useRef<Token | undefined>(toToken)
  const prevEditingSideRef = useRef<"sell" | "buy">(editingSide)

  useEffect(() => {
    // If tokens changed, we need to wait for new quote
    // The quote hook will handle the recalculation
    const fromTokenChanged = prevFromTokenRef.current?.address !== fromToken?.address
    const toTokenChanged = prevToTokenRef.current?.address !== toToken?.address
    const editingSideChanged = prevEditingSideRef.current !== editingSide

    // Reset insufficientBalance when tokens or editing side changes
    if (fromTokenChanged || toTokenChanged || editingSideChanged) {
      setInsufficientBalance(false)
    }

    // If tokens changed, reset timer but don't refetch immediately if it's a same-token-pair switch
    if (fromTokenChanged || toTokenChanged) {
      setTimeLeft(15)
      hasRefetchedRef.current = false

      // Skip immediate refetch for same-token-pair switches - let timer handle it
      if (justSwitchedSamePairRef.current) {
        justSwitchedSamePairRef.current = false // Reset flag
        // Timer will handle refetch at 1 second
      } else if (!isSwitching) {
        // Normal token change (not during switch) - quote hook will handle instant fetch
        // The useQuote hook detects token changes and fetches immediately
        // This refetch() call is redundant but harmless
        if (amount && parseFloat(amount) > 0 && fromToken && toToken) {
          refetch()
        }
      }
    }

    prevFromTokenRef.current = fromToken
    prevToTokenRef.current = toToken
    prevEditingSideRef.current = editingSide
  }, [fromToken, toToken, editingSide, amount, refetch])

  // Clear preserved display quote, swapped quote, and swapped prices when new quote arrives
  useEffect(() => {
    if (quote) {
      if (preservedDisplayQuote) {
        setPreservedDisplayQuote(null)
      }
      if (swappedQuote) {
        setSwappedQuote(null)
      }
      if (swappedFromTokenPrice !== null || swappedToTokenPrice !== null) {
        setSwappedFromTokenPrice(null)
        setSwappedToTokenPrice(null)
      }
    }
  }, [quote, preservedDisplayQuote, swappedQuote, swappedFromTokenPrice, swappedToTokenPrice])

  // Simplified quote display logic - use quote directly
  // Preserve swapped values during switch to prevent showing "0"
  // Use swapped quote if available (for same-token-pair switches)
  // For wrap/unwrap, components will use amount directly (1:1) - return null here
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

  // Reset timer when quote changes or amount changes
  const prevAmountRef = useRef(amount)
  const prevQuoteRef = useRef(quote)
  useEffect(() => {
    // Don't reset timer for wrap/unwrap operations (no quote needed)
    if (isWrapUnwrap) {
      prevAmountRef.current = amount
      prevQuoteRef.current = quote
      return
    }

    const amountChanged = prevAmountRef.current !== amount
    const quoteChanged = prevQuoteRef.current !== quote

    // Reset timer when we get a new fetched quote (not swapped quote)
    if (quote && quoteChanged) {
      setTimeLeft(15)
      hasRefetchedRef.current = false
    } else if (amountChanged && amount && parseFloat(amount) > 0) {
      // Amount changed but no quote yet - reset timer when quote arrives
      // This ensures timer resets even if quote is still loading
      setTimeLeft(15)
      hasRefetchedRef.current = false
    }
    prevAmountRef.current = amount
    prevQuoteRef.current = quote
  }, [quote, amount, isWrapUnwrap])

  // Auto-refresh quote timer
  useEffect(() => {
    // Don't run timer for wrap/unwrap operations (no quote needed)
    if (isWrapUnwrap) {
      setTimeLeft(15)
      hasRefetchedRef.current = false
      return
    }

    // Run timer if we have a displayQuote (either from fetched quote or swapped quote)
    // This ensures timer works even when using swapped quote temporarily
    if (!displayQuote || isSwitching) {
      setTimeLeft(15)
      hasRefetchedRef.current = false
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1

        if (newTime === 1) {
          // Always refetch at 1 second mark - use ref to get latest refetch function
          // Check isSwitching from state, not closure
          const currentIsSwitching = isSwitching
          if (!currentIsSwitching) {
            hasRefetchedRef.current = true
            setPulseKey((k) => k + 1)
            // Call refetch directly using ref to ensure we have latest version
            refetchRef.current().catch((err) => {
              console.error("Timer refetch error:", err)
            })
          }
        }

        if (newTime <= 0) {
          hasRefetchedRef.current = false
          setPulseKey(0)
          return 15
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [displayQuote, isSwitching, isWrapUnwrap]) // Add isWrapUnwrap to deps

  // Pulse animation for loading states
  useEffect(() => {
    if (isQuoteLoading && displayQuote) {
      setPulseAnimationKey((prev) => prev + 1)
    }
  }, [isQuoteLoading, displayQuote])

  // For wrap/unwrap, use amount directly (1:1)
  // For regular swaps, use displayQuote or fallback to "0"
  const outputAmount = isWrapUnwrap ? amount : displayQuote || "0"
  // For wrap/unwrap, use wrap/unwrap gas loading state
  // For wrap/unwrap, no pulse animation needed (no quote loading)
  const effectiveQuoteLoading = isWrapUnwrap ? isLoadingWrapUnwrapGas : isQuoteLoading
  const shouldPulse =
    !isWrapUnwrap && (effectiveQuoteLoading || pulseKey > 0) && displayQuote !== null
  const shouldPulseLoop = !isWrapUnwrap && effectiveQuoteLoading && displayQuote !== null

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

    // Always check fromToken (sell token) balance, regardless of editingSide
    // The user is always selling fromToken, so insufficient balance should always reference it
    if (!fromToken) {
      setInsufficientBalance(false)
      return
    }

    // If balance is still loading, don't show insufficient balance error yet
    // But if we have an amount and balance finished loading, we should check
    if (isLoadingFromBalance) {
      // Don't set insufficientBalance to false here - keep previous state
      // This prevents flickering and ensures we check once balance loads
      return
    }

    // Ensure we have a balance result (either loaded balance or confirmed 0)
    // For ERC20 tokens, fromBalance should exist even with 0 balance after loading completes
    // But handle the case where balance query hasn't started or failed
    // Use the balance value (will be 0 if fromBalance is undefined or has 0 value)
    const balanceValue = fromBalanceValue

    // Calculate the amount to check based on editingSide
    // If editing buy side, amount is in toToken units, so we need to check if we have enough fromToken
    // If editing sell side, amount is in fromToken units, so we check directly
    let amountToCheck = amountValue

    if (editingSide === "buy") {
      // For wrap/unwrap pairs, it's 1:1 so use amount directly
      if (isWrapUnwrap) {
        amountToCheck = amountValue
      } else if (activeQuote?.amountInFormatted) {
        // When editing buy side, amount is the desired output (toToken)
        // We need to check if we have enough fromToken to get that amount
        // Parse the formatted amount (remove commas)
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
    let availableBalance = balanceValue
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
        // Subtract estimated gas cost from available balance
        const gasCostEth = (Number(gasEstimate) * Number(gasPrice)) / 1e18
        availableBalance = Math.max(0, balanceValue - gasCostEth)
      }
    }

    // More generous tolerance for precision issues and small differences
    const tolerance = Math.max(availableBalance * 0.01, Math.pow(10, -fromToken.decimals), 0.000001)
    // Allow amounts within tolerance of the balance (handles precision issues)
    const exceedsBalance = amountToCheck > availableBalance + tolerance

    // Debug log for insufficient balance
    if (isWrapUnwrap && exceedsBalance !== insufficientBalance) {
      console.log("Balance check result:", {
        exceedsBalance,
        currentInsufficientBalance: insufficientBalance,
        amountToCheck,
        availableBalance,
        fromToken: fromToken?.symbol,
      })
    }

    setInsufficientBalance(exceedsBalance)
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
    isLoadingFromBalance,
    isLoadingToBalance,
    displayQuote,
    quote,
    activeQuote,
    gasPrice,
    isWrapUnwrap,
    isWrap,
    wrapUnwrapGasEstimate,
  ])

  // Focus the appropriate input when editingSide changes (especially after switch)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingSide === "sell" && sellInputRef.current) {
        sellInputRef.current.focus()
      } else if (editingSide === "buy" && buyInputRef.current) {
        buyInputRef.current?.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [editingSide])
  const commonTokens = useMemo(() => {
    const symbols = ["ETH", "USDC", "USDT", "WBTC", "WETH"]
    const foundTokens: Token[] = []

    symbols.forEach((symbol) => {
      const token = tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase())

      if (token) {
        // Include the token if it's not currently selected on either side
        if (token.address !== fromToken?.address && token.address !== toToken?.address) {
          foundTokens.push(token)
        }
      }
    })

    // If no ETH is included but we have room, add ETH (unless it's selected)
    if (
      foundTokens.length < 5 &&
      (!fromToken || fromToken.symbol.toUpperCase() !== "ETH") &&
      (!toToken || toToken.symbol.toUpperCase() !== "ETH")
    ) {
      const ethToken = tokens.find((t) => t.symbol.toUpperCase() === "ETH") || DEFAULT_ETH_TOKEN
      if (!foundTokens.some((t) => t.address === ethToken.address)) {
        foundTokens.unshift(ethToken)
      }
    }

    return foundTokens.slice(0, 5) // Limit to 5 tokens
  }, [tokens, fromToken, toToken])

  // Use exchange rate from quote if available, otherwise calculate
  const exchangeRate = useMemo(() => {
    if (!quote || !fromToken || !toToken) return 0
    // Use activeQuote.exchangeRate if available (more accurate)
    if (activeQuote.exchangeRate && activeQuote.exchangeRate > 0) {
      return activeQuote.exchangeRate
    }
    // Fallback to calculation from formatted amounts
    const amountIn = parseFloat(activeQuote.amountInFormatted)
    const amountOut = parseFloat(activeQuote.amountOutFormatted)
    if (amountIn === 0) return 0
    return amountOut / amountIn
  }, [quote, fromToken, toToken])

  // Use minOutFormatted directly from quote instead of recalculating
  const minAmountOut = useMemo(() => {
    if (!quote) return "0"
    // Use the pre-calculated minOutFormatted from the quote hook
    return activeQuote.minOutFormatted
  }, [activeQuote])

  const { confirmSwap, isSigning, isSubmitting } = useSwapConfirmation({
    fromToken,
    toToken,
    amount,
    minAmountOut,
    deadline,
    onSuccess: () => {
      setAmount("")
    },
  })

  const priceImpactSeverity = activeQuote ? getPriceImpactSeverity(activeQuote.priceImpact) : "low"
  const hasHighPriceImpact = activeQuote ? Math.abs(activeQuote.priceImpact) > 3 : false
  const hasVeryHighPriceImpact = activeQuote ? Math.abs(activeQuote.priceImpact) > 10 : false

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
    hasEverStartedRef.current = true
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
        // Check if we're switching the same token pair (just swapped)
        // If fromToken->toToken becomes toToken->fromToken, we can reuse the quote
        const isSameTokenPairSwitch =
          fromToken &&
          toToken &&
          newFromToken &&
          newToToken &&
          fromToken.address === newToToken.address &&
          toToken.address === newFromToken.address &&
          quote !== null

        if (isSameTokenPairSwitch && quote) {
          // Create a swapped quote by inverting the amounts
          const invertedQuote: QuoteResult = {
            amountOut: quote.amountIn,
            amountOutFormatted: quote.amountInFormatted,
            amountIn: quote.amountOut,
            amountInFormatted: quote.amountOutFormatted,
            minOut: quote.amountIn, // Approximate - we'll recalculate on next quote
            minOutFormatted: quote.amountInFormatted,
            priceImpact: -quote.priceImpact, // Invert price impact
            exchangeRate: quote.exchangeRate > 0 ? 1 / quote.exchangeRate : 0,
            gasEstimate: quote.gasEstimate,
            fee: quote.fee,
          }
          setSwappedQuote(invertedQuote)

          // Swap token prices - capture current prices before state update
          // After switch: new fromToken = old toToken, new toToken = old fromToken
          // So: new fromTokenPrice should be old toTokenPrice, new toTokenPrice should be old fromTokenPrice
          setSwappedFromTokenPrice(toTokenPrice) // Old toToken's price becomes new fromToken's price
          setSwappedToTokenPrice(fromTokenPrice) // Old fromToken's price becomes new toToken's price

          // Mark that we just switched same pair to skip immediate refetch
          justSwitchedSamePairRef.current = true
        } else {
          // Clear swapped quote and prices if tokens actually changed
          setSwappedQuote(null)
          setSwappedFromTokenPrice(null)
          setSwappedToTokenPrice(null)
          justSwitchedSamePairRef.current = false
        }

        // Preserve the swapped display quote before clearing quote
        // This prevents showing "0" during the switch transition
        // Only preserve if it's a valid non-zero value
        if (newDisplayQuote && newDisplayQuote !== "0" && newDisplayQuote.trim() !== "") {
          setPreservedDisplayQuote(newDisplayQuote)
        }

        // Disable quote fetching during switch
        setIsSwitching(true)
        // Don't clear insufficientBalance here - let the balance check useEffect handle it
        // This ensures the error state persists if the new token also has insufficient balance
        setPulseKey(0)
        setPulseAnimationKey(0)

        // Update all state atomically
        setFromToken(newFromToken)
        setToToken(newToToken)
        setHasExplicitlyClearedFromToken(newHasExplicitlyClearedFromToken)
        setHasExplicitlyClearedToToken(newHasExplicitlyClearedToToken)
        // Set amount to the swapped value (should be the active side's amount, not "0")
        setAmount(newAmount || "")
        setEditingSide(newEditingSide)

        // Re-enable quote fetching immediately (no delay)
        // The timer will handle refetching naturally
        requestAnimationFrame(() => {
          setIsSwitching(false)
        })
      },
      [fromToken, toToken, quote]
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
            slippage={effectiveSlippage}
            deadline={deadline}
            onSlippageChange={handleSlippageChange}
            onDeadlineChange={handleDeadlineChange}
            isSettingsOpen={isSettingsOpen}
            onSettingsOpenChange={setIsSettingsOpen}
            isAutoSlippage={isAutoSlippage}
            onAutoSlippageChange={handleAutoSlippageChange}
          />
        </div>
      )}

      <div className="relative">
        {/* Bleeding edge effect */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-[#131313]/40 via-[#131313]/20 to-transparent backdrop-blur-2xl -z-10 scale-105",
            isDockVisible ? "rounded-b-[24px] rounded-t-none" : "rounded-[24px]"
          )}
        />

        {/* Main interface */}
        <div
          className={cn(
            "w-full bg-[#131313]/60 backdrop-blur-xl border border-white/[0.08] p-2 flex flex-col relative z-10 transition-all duration-500",
            "shadow-[inset_0_0_40px_rgba(255,255,255,0.01)]",
            "before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.03] before:via-transparent before:to-black/[0.02] before:rounded-[24px] before:pointer-events-none before:opacity-60",
            "after:absolute after:inset-0 after:bg-gradient-to-tr after:from-transparent after:via-white/[0.02] after:to-transparent after:opacity-0 group-hover:after:opacity-100 after:transition-opacity after:duration-1000 after:pointer-events-none after:rounded-[24px]",
            isDockVisible
              ? "rounded-b-[24px] rounded-t-none border-t-0 before:rounded-b-[24px] before:rounded-t-none after:rounded-b-[24px] after:rounded-t-none"
              : "rounded-[24px]"
          )}
        >
          <TokenSwapSection
            side="sell"
            label="Sell"
            isActive={editingSide === "sell"}
            token={fromToken}
            amount={amount}
            displayQuote={
              isWrapUnwrap
                ? amount // Simple 1:1 for wrap/unwrap - bypass quote entirely
                : noLiquidity && editingSide === "buy"
                  ? "No liquidity"
                  : displayQuote || null
            }
            quoteAmount={activeQuote?.amountInFormatted}
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
            tokenPrice={activeFromTokenPrice}
            isLoadingPrice={isLoadingFromPrice && swappedFromTokenPrice === null}
            isConnected={isConnected}
            address={address}
            insufficientBalance={insufficientBalance}
            shouldPulse={shouldPulse}
            shouldPulseLoop={shouldPulseLoop}
            isQuoteLoading={effectiveQuoteLoading}
            pulseAnimationKey={pulseAnimationKey}
            inputRef={sellInputRef}
            outputAmount={outputAmount}
            commonTokens={commonTokens}
            onCommonTokenSelect={handleFromTokenSelect}
            gasEstimate={
              isWrapUnwrap
                ? wrapUnwrapGasEstimate?.toString()
                : activeQuote?.gasEstimate?.toString()
            }
            gasPrice={gasPrice?.toString()}
            isNativeETH={fromToken?.address === ZERO_ADDRESS}
          />

          <SwitchButton onSwitch={handleSwitch} />

          <TokenSwapSection
            side="buy"
            label="Buy"
            isActive={editingSide === "buy"}
            token={toToken}
            amount={amount}
            displayQuote={
              isWrapUnwrap
                ? amount // Simple 1:1 for wrap/unwrap - bypass quote entirely
                : noLiquidity && editingSide === "sell"
                  ? "No liquidity"
                  : displayQuote || null
            }
            quoteAmount={activeQuote?.amountOutFormatted}
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
            tokenPrice={activeToTokenPrice}
            isLoadingPrice={isLoadingToPrice && swappedToTokenPrice === null}
            isConnected={isConnected}
            address={address}
            insufficientBalance={false}
            shouldPulse={shouldPulse}
            shouldPulseLoop={shouldPulseLoop}
            isQuoteLoading={effectiveQuoteLoading}
            pulseAnimationKey={pulseAnimationKey}
            inputRef={buyInputRef}
            outputAmount={outputAmount}
            commonTokens={commonTokens}
            onCommonTokenSelect={handleToTokenSelect}
          />

          {hasStarted && activeQuote && fromToken && toToken && (
            <SwapReview
              fromToken={fromToken}
              toToken={toToken}
              quote={quote}
              exchangeRate={exchangeRate}
              minAmountOut={minAmountOut}
              slippage={effectiveSlippage}
              ethPrice={ethPrice}
              timeLeft={timeLeft}
              displayQuote={displayQuote || null}
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
            show={!!quoteError && !!amount && parseFloat(amount) > 0 && !!fromToken && !!toToken}
          />

          <SwapActionButton
            hasStarted={hasStarted || hasEverStartedRef.current}
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
            isWrap={isWrap}
            isUnwrap={isUnwrap}
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
                amountOut={isWrapUnwrap ? amount : activeQuote?.amountOutFormatted || "0"}
                minAmountOut={isWrapUnwrap ? amount : minAmountOut}
                exchangeRate={isWrapUnwrap ? 1 : exchangeRate}
                priceImpact={isWrapUnwrap ? 0 : activeQuote?.priceImpact || 0}
                slippage={effectiveSlippage}
                gasEstimate={
                  isWrapUnwrap ? wrapUnwrapGasEstimate || null : activeQuote?.gasEstimate || null
                }
                ethPrice={ethPrice}
                timeLeft={isWrapUnwrap ? undefined : timeLeft}
                isLoading={
                  isWrapUnwrap
                    ? isWrapUnwrapPending || isWrapUnwrapConfirming
                    : isSigning || isSubmitting
                }
                isWrap={isWrap}
                isUnwrap={isUnwrap}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  )
}
