"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPublicClient, http, parseUnits, formatUnits, type Address } from "viem"
import { mainnet } from "wagmi/chains"
import { RPC_ENDPOINT, FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"
import { sanitizeAmountInput, formatTokenAmount } from "@/lib/utils"
import { resolveTokenAddress, resolveTokenDecimals, getTokenSymbol } from "@/lib/token-resolver"
import type { Token } from "@/types/swap"

// Uniswap V3 Quoter V2 on Ethereum mainnet
const QUOTER_V2_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const

// Optimization: Memoize the client outside the hook to prevent recreation
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(FALLBACK_RPC_ENDPOINT, {
    batch: { wait: 50 }, // Increased from 20 to 50ms to group more fee-tier calls
    fetchOptions: { cache: "no-store" },
  }),
})

// Uniswap V3 Quoter ABI (supports both exact input and exact output)
const QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactOutputSingle",
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const

// Common fee tiers in Uniswap V3 (in hundredths of a bip)
const FEE_TIERS = [500, 3000, 10000] as const // 0.05%, 0.3%, 1%

/**
 * Create a promise that resolves with the result or rejects after timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timeout")), timeoutMs)
  })

  return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise])
}

/**
 * Fetch quotes for all fee tiers in parallel with timeout for faster failure
 */
async function getBestQuoteFromFeeTiers(
  client: any,
  tokenInAddress: Address,
  tokenOutAddress: Address,
  amountIn: string,
  tradeType: TradeType,
  tokenInDecimals: number,
  tokenOutDecimals: number
): Promise<{
  amountOut: bigint
  amountIn: bigint
  gasEstimate: bigint
  fee: number
} | null> {
  // PERFORMANCE FIX: Wait for the main thread to be idle before starting
  // This prevents the 'Click' and 'Input' violations from escalating.
  await new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(null))
    } else {
      setTimeout(resolve, 1)
    }
  })

  // Create promises for all fee tiers with 2 second timeout each
  const feeTierPromises = FEE_TIERS.map(async (fee) => {
    try {
      const contractCall = (async () => {
        let result

        if (tradeType === "exactIn") {
          const amountInWei = parseUnits(amountIn, tokenInDecimals)
          result = await client.simulateContract({
            address: QUOTER_V2_ADDRESS,
            abi: QUOTER_ABI,
            functionName: "quoteExactInputSingle",
            args: [
              {
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                amountIn: amountInWei,
                fee,
                sqrtPriceLimitX96: BigInt(0),
              },
            ],
          })

          const [amountOut, , , gasEstimate] = result.result as [bigint, bigint, number, bigint]

          return { amountOut, amountIn: amountInWei, gasEstimate, fee, success: true }
        } else {
          const amountOutWei = parseUnits(amountIn, tokenOutDecimals)
          result = await client.simulateContract({
            address: QUOTER_V2_ADDRESS,
            abi: QUOTER_ABI,
            functionName: "quoteExactOutputSingle",
            args: [
              {
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                amount: amountOutWei,
                fee,
                sqrtPriceLimitX96: BigInt(0),
              },
            ],
          })

          const [amountInWei, , , gasEstimate] = result.result as [bigint, bigint, number, bigint]

          return { amountOut: amountOutWei, amountIn: amountInWei, gasEstimate, fee, success: true }
        }
      })()

      // Add 3 second timeout to each contract call
      return await withTimeout(contractCall, 5000)
    } catch (error) {
      // Fee tier failed or timed out, return failure indicator
      console.debug(`No pool for fee tier ${fee}:`, error)
      return { success: false, fee }
    }
  })

  // Wait for all fee tier promises to settle (with timeouts)
  const results = await Promise.allSettled(feeTierPromises)

  // Collect all successful quotes
  const successfulQuotes: Array<{
    amountOut: bigint
    amountIn: bigint
    gasEstimate: bigint
    fee: number
  }> = []

  for (const result of results) {
    if (result.status === "fulfilled" && result.value && (result.value as any).success) {
      successfulQuotes.push(result.value as any)
    }
  }

  if (successfulQuotes.length === 0) {
    return null // No fee tiers worked
  }

  // Return the best quote among successful ones
  let bestQuote = successfulQuotes[0]
  for (let i = 1; i < successfulQuotes.length; i++) {
    const quote = successfulQuotes[i]
    if (tradeType === "exactIn") {
      // For exact input, we want maximum output
      if (quote.amountOut > bestQuote.amountOut) {
        bestQuote = quote
      }
    } else {
      // For exact output, we want minimum input
      if (quote.amountIn < bestQuote.amountIn) {
        bestQuote = quote
      }
    }
  }

  console.log("[useQuote] Best quote selected:", {
    fee: bestQuote.fee,
    amountOut: bestQuote.amountOut.toString(),
    successfulQuotesCount: successfulQuotes.length,
    successfulFees: successfulQuotes.map((q) => q.fee),
  })

  return bestQuote
}

export interface QuoteResult {
  amountOut: bigint
  amountOutFormatted: string
  amountIn: bigint
  amountInFormatted: string
  minOut: bigint
  minOutFormatted: string
  priceImpact: number // as percentage, e.g., -0.02
  exchangeRate: number
  gasEstimate: bigint
  fee: number // fee tier used
}

export type TradeType = "exactIn" | "exactOut"

export interface UseQuoteProps {
  tokenIn: Token | undefined // Changed from string to Token object
  tokenOut: Token | undefined // Changed from string to Token object
  amountIn: string
  slippage: string // e.g., "0.5" for 0.5%
  enabled?: boolean
  debounceMs?: number
  tradeType?: TradeType // "exactIn" when typing sell amount, "exactOut" when typing buy amount
  tokenList?: Token[] // Token list for fallback lookup
}

export interface UseQuoteReturn {
  quote: QuoteResult | null
  isLoading: boolean
  error: Error | null
  noLiquidity: boolean
  refetch: () => Promise<void>
}

// Create public client for RPC calls
function createClient(rpcUrl: string) {
  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, {
      batch: true,
      fetchOptions: { cache: "no-store" },
    }),
  })
}

/**
 * Validate slippage input
 * @param slippage Raw slippage string
 * @returns Validated slippage percentage or default
 */
function validateSlippage(slippage: string): number {
  const num = parseFloat(slippage)
  if (isNaN(num) || num < 0) return 0.5 // Default to 0.5%
  if (num > 50) return 50 // Cap at 50%
  return num
}

/**
 * Calculate auto slippage based on trade characteristics
 * Returns a value between 0.1% and 5% based on:
 * - Trade size (larger trades need more slippage tolerance)
 * - Token type (stablecoins need less, volatile tokens need more)
 * - Network conditions (higher gas = more slippage tolerance)
 * @param tradeAmount - Trade amount in token units
 * @param tokenIn - Input token object or symbol
 * @param tokenOut - Output token object or symbol
 * @param gasPriceGwei - Current gas price in gwei (optional)
 * @returns Auto slippage percentage
 */
export function calculateAutoSlippage(
  tradeAmount: number,
  tokenIn: Token | string,
  tokenOut: Token | string,
  gasPriceGwei?: number | null
): number {
  // Base slippage for small trades
  let slippage = 0.1

  // Get token symbols for comparison
  const tokenInSymbol = getTokenSymbol(tokenIn)?.toUpperCase() || ""
  const tokenOutSymbol = getTokenSymbol(tokenOut)?.toUpperCase() || ""

  // Check if tokens are stablecoins (need less slippage)
  const STABLECOINS = ["USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX", "USDP", "LUSD"]
  const isStablecoinPair =
    STABLECOINS.includes(tokenInSymbol) || STABLECOINS.includes(tokenOutSymbol)

  // Adjust based on trade size
  // Larger trades need more slippage tolerance
  if (tradeAmount > 100000) {
    slippage += 1.0 // Large trades: +1%
  } else if (tradeAmount > 10000) {
    slippage += 0.5 // Medium trades: +0.5%
  } else if (tradeAmount > 1000) {
    slippage += 0.2 // Small-medium trades: +0.2%
  }

  // Adjust based on token volatility
  if (!isStablecoinPair) {
    slippage += 0.3 // Volatile pairs need more slippage
  }

  // Adjust based on gas prices (higher gas = more slippage tolerance to avoid reverts)
  if (gasPriceGwei) {
    if (gasPriceGwei > 100) {
      slippage += 0.5 // Very high gas
    } else if (gasPriceGwei > 50) {
      slippage += 0.3 // High gas
    } else if (gasPriceGwei > 20) {
      slippage += 0.1 // Medium gas
    }
  }

  // Clamp between 0.1% and 5%
  return Math.max(0.1, Math.min(5.0, slippage))
}

/**
 * Hook for fetching real-time quotes from Uniswap V3
 * Includes debouncing, slippage calculation, price impact estimation,
 * and comprehensive input validation/sanitization
 */
export function useQuote({
  tokenIn,
  tokenOut,
  amountIn,
  slippage,
  enabled = true,
  debounceMs = 500,
  tradeType = "exactIn",
  tokenList = [],
}: UseQuoteProps): UseQuoteReturn {
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [noLiquidity, setNoLiquidity] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0) // Track request IDs to prevent stale quotes

  // Track previous values to detect changes
  const prevTokenInRef = useRef<Token | undefined>(tokenIn)
  const prevTokenOutRef = useRef<Token | undefined>(tokenOut)
  const prevAmountInRef = useRef<string>(amountIn)
  const prevSlippageRef = useRef<string>(slippage)
  const prevTradeTypeRef = useRef<TradeType>(tradeType)

  // Store latest values in refs so refetch can always access them
  const latestTokenInRef = useRef<Token | undefined>(tokenIn)
  const latestTokenOutRef = useRef<Token | undefined>(tokenOut)
  const latestAmountInRef = useRef<string>(amountIn)
  const latestSlippageRef = useRef<string>(slippage)
  const latestTradeTypeRef = useRef<TradeType>(tradeType)
  const latestTokenListRef = useRef<Token[]>(tokenList)
  const latestEnabledRef = useRef<boolean>(enabled)
  const isFetchingRef = useRef(false)
  const quoteRef = useRef<QuoteResult | null>(null)
  const prevQuoteRef = useRef<any>(null)
  const lastInputKeyRef = useRef<string>("")

  // Update latest refs whenever values change
  useEffect(() => {
    latestTokenInRef.current = tokenIn
    latestTokenOutRef.current = tokenOut
    latestAmountInRef.current = amountIn
    latestSlippageRef.current = slippage
    latestTradeTypeRef.current = tradeType
    latestTokenListRef.current = tokenList
    latestEnabledRef.current = enabled
  }, [tokenIn, tokenOut, amountIn, slippage, tradeType, tokenList, enabled])

  // Create a stable refetch function that always works, using latest refs
  const refetch = useCallback(async () => {
    // Respect enabled flag (e.g. disabled for wrap/unwrap pairs)
    if (!latestEnabledRef.current) {
      return
    }

    // Exhaustive debouncing: Ignore if a request is already in flight
    if (isFetchingRef.current) return

    // Use latest values from refs to ensure we always fetch with current state
    const currentTokenIn = latestTokenInRef.current
    const currentTokenOut = latestTokenOutRef.current
    const currentAmountIn = latestAmountInRef.current
    const currentTradeType = latestTradeTypeRef.current
    const currentTokenList = latestTokenListRef.current

    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      // Only log cancellation in development/debug mode
      if (process.env.NODE_ENV === "development") {
        console.debug(`[useQuote] Cancelled previous request for new request ${currentRequestId}`)
      }
    }
    abortControllerRef.current = new AbortController()

    // Validate token inputs
    if (!currentTokenIn || !currentTokenOut) {
      if (currentRequestId === requestIdRef.current) {
        setQuote(null)
        setError(null)
        setIsLoading(false)
      }
      return
    }

    // Check if tokens are the same (by address)
    if (currentTokenIn.address === currentTokenOut.address) {
      if (currentRequestId === requestIdRef.current) {
        setError(new Error("Cannot swap a token for itself. Please select different tokens."))
        setQuote(null)
        setIsLoading(false)
      }
      return
    }

    // Sanitize and validate amount input
    const amountInNum = sanitizeAmountInput(currentAmountIn)
    if (amountInNum === null || amountInNum <= 0) {
      if (currentRequestId === requestIdRef.current) {
        setQuote(null)
        setError(null)
        setIsLoading(false)
      }
      return
    }

    // Debug logging with timing
    const startTime = performance.now()
    console.log("[useQuote] Refetching quote:", {
      requestId: currentRequestId,
      tokenIn: getTokenSymbol(currentTokenIn),
      tokenOut: getTokenSymbol(currentTokenOut),
      amountIn: currentAmountIn,
      tradeType: currentTradeType,
      amountInNum,
      timestamp: startTime,
    })

    // Validate amount is not too large
    const MAX_AMOUNT = 1e21
    if (amountInNum > MAX_AMOUNT) {
      setError(new Error("Amount is too large. Please enter a smaller amount."))
      setQuote(null)
      setIsLoading(false)
      return
    }

    // Resolve token addresses
    const tokenInAddress = resolveTokenAddress(currentTokenIn, currentTokenList)
    const tokenOutAddress = resolveTokenAddress(currentTokenOut, currentTokenList)

    if (!tokenInAddress || !tokenOutAddress) {
      const missingToken = !tokenInAddress ? currentTokenIn : currentTokenOut
      const tokenSymbol = getTokenSymbol(missingToken) || "Unknown"
      if (currentRequestId === requestIdRef.current) {
        setError(
          new Error(`Token address not found for ${tokenSymbol}. This token may not be supported.`)
        )
        setQuote(null)
        setIsLoading(false)
      }
      return
    }

    // Only proceed if this is still the latest request
    if (currentRequestId !== requestIdRef.current) {
      console.log(
        "[useQuote] Request outdated, aborting:",
        currentRequestId,
        "current:",
        requestIdRef.current
      )
      return
    }

    setIsLoading(true)
    setError(null)
    setNoLiquidity(false)

    // Request timeout (15 seconds)
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current && currentRequestId === requestIdRef.current) {
        abortControllerRef.current.abort()
      }
    }, 15000)

    try {
      // Resolve token decimals
      const tokenInDecimals = resolveTokenDecimals(currentTokenIn, currentTokenList)
      const tokenOutDecimals = resolveTokenDecimals(currentTokenOut, currentTokenList)

      let bestQuote: {
        amountOut: bigint
        amountIn: bigint
        gasEstimate: bigint
        fee: number
      } | null = null

      // Try each RPC client and get best quote with parallel fee tier checking
      const clients = [createClient(FALLBACK_RPC_ENDPOINT)]
      let workingClient = clients[0]

      for (const client of clients) {
        try {
          // Use parallel fee tier checking
          const quote = await getBestQuoteFromFeeTiers(
            client,
            tokenInAddress,
            tokenOutAddress,
            currentAmountIn,
            currentTradeType,
            tokenInDecimals,
            tokenOutDecimals
          )

          if (quote) {
            bestQuote = quote
            workingClient = client
            break // Found a working quote, no need to try other clients
          }
        } catch (clientError) {
          console.warn("RPC client error, trying next:", clientError)
        }
      }

      if (!bestQuote) {
        // Instead of throwing an error, set noLiquidity state
        if (currentRequestId === requestIdRef.current) {
          setNoLiquidity(true)
          setQuote(null)
          setError(null)
          console.log("[useQuote] No liquidity found:", {
            requestId: currentRequestId,
            tokenIn: getTokenSymbol(currentTokenIn),
            tokenOut: getTokenSymbol(currentTokenOut),
          })
        }
        return
      }

      // Check again if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        console.log(
          "[useQuote] Request outdated before processing result:",
          currentRequestId,
          "current:",
          requestIdRef.current
        )
        return
      }

      // Calculate formatted amounts
      const amountOutRaw = formatUnits(bestQuote.amountOut, tokenOutDecimals)
      const amountOutNum = parseFloat(amountOutRaw)
      const amountInRaw = formatUnits(bestQuote.amountIn, tokenInDecimals)
      const amountInNum = parseFloat(amountInRaw)

      // Format based on token type
      const tokenOutSymbol = getTokenSymbol(currentTokenOut) || ""
      const tokenInSymbol = getTokenSymbol(currentTokenIn) || ""
      const amountOutFormatted = formatTokenAmount(amountOutNum, tokenOutSymbol)
      const amountInFormatted = formatTokenAmount(amountInNum, tokenInSymbol)

      // Calculate minOut/maxIn based on slippage
      const slippagePercent = validateSlippage(latestSlippageRef.current)
      const slippageBps = BigInt(Math.floor(slippagePercent * 100))

      let minOut: bigint
      let minOutFormatted: string

      if (currentTradeType === "exactIn") {
        minOut = (bestQuote.amountOut * (BigInt(10000) - slippageBps)) / BigInt(10000)
        const minOutNum = parseFloat(formatUnits(minOut, tokenOutDecimals))
        minOutFormatted = formatTokenAmount(minOutNum, tokenOutSymbol)
      } else {
        minOut = (bestQuote.amountIn * (BigInt(10000) + slippageBps)) / BigInt(10000)
        const minOutNum = parseFloat(formatUnits(minOut, tokenInDecimals))
        minOutFormatted = formatTokenAmount(minOutNum, tokenInSymbol)
      }

      // Calculate exchange rate
      const exchangeRate = amountOutNum / amountInNum

      // Calculate price impact
      let priceImpact = 0
      try {
        const spotAmountIn = parseUnits("0.000001", tokenInDecimals)
        const spotResult = await workingClient.simulateContract({
          address: QUOTER_V2_ADDRESS,
          abi: QUOTER_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: tokenInAddress,
              tokenOut: tokenOutAddress,
              amountIn: spotAmountIn,
              fee: bestQuote.fee,
              sqrtPriceLimitX96: BigInt(0),
            },
          ],
        })

        const [spotAmountOut] = spotResult.result as [bigint, bigint, number, bigint]
        const spotAmountOutNum = parseFloat(formatUnits(spotAmountOut, tokenOutDecimals))
        const spotAmountInNum = parseFloat(formatUnits(spotAmountIn, tokenInDecimals))
        const spotPrice = spotAmountOutNum / spotAmountInNum
        const executionPrice = exchangeRate

        if (spotPrice > 0) {
          priceImpact = ((executionPrice - spotPrice) / spotPrice) * 100
        }
      } catch (spotError) {
        console.debug("Failed to fetch spot price, using estimate:", spotError)
        const tradeAmount = currentTradeType === "exactIn" ? amountInNum : amountOutNum
        priceImpact = -0.01 * Math.log10(tradeAmount + 1)
      }

      priceImpact = Math.max(Math.min(priceImpact, 0), -50)

      // Create new quote object
      const newQuote: QuoteResult = {
        amountOut: bestQuote.amountOut,
        amountOutFormatted,
        amountIn: bestQuote.amountIn,
        amountInFormatted,
        minOut,
        minOutFormatted,
        priceImpact,
        exchangeRate,
        gasEstimate: bestQuote.gasEstimate,
        fee: bestQuote.fee,
      }

      // Only set quote if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        const endTime = performance.now()
        const duration = endTime - startTime
        console.log("[useQuote] Refetch quote result:", {
          requestId: currentRequestId,
          tokenIn: getTokenSymbol(currentTokenIn),
          tokenOut: getTokenSymbol(currentTokenOut),
          tradeType: currentTradeType,
          amountIn: currentAmountIn,
          amountInFormatted: newQuote.amountInFormatted,
          amountOutFormatted: newQuote.amountOutFormatted,
          duration: `${duration.toFixed(2)}ms`,
        })

        // Compare new vs old quote to prevent unnecessary re-renders
        const isIdentical =
          prevQuoteRef.current?.amountOut === newQuote.amountOut &&
          prevQuoteRef.current?.fee === newQuote.fee &&
          prevQuoteRef.current?.amountIn === newQuote.amountIn

        if (isIdentical) {
          setIsLoading(false)
          return // BREAK THE LOOP: Do not update state if the quote is the same
        }

        prevQuoteRef.current = newQuote
        setQuote(newQuote)
        setError(null)
      } else {
        console.log(
          "[useQuote] Ignoring stale refetch quote:",
          currentRequestId,
          "current:",
          requestIdRef.current
        )
      }
    } catch (err) {
      let errorMessage = "Failed to fetch quote"

      if (err instanceof Error) {
        if (err.message.includes("aborted") || err.name === "AbortError") {
          errorMessage = "Quote request was cancelled"
        } else if (err.message.includes("timeout") || err.message.includes("time")) {
          errorMessage = "Quote request timed out. Please try again."
        } else if (err.message.includes("liquidity")) {
          errorMessage = err.message
        } else if (err.message.includes("network") || err.message.includes("fetch")) {
          errorMessage = "Network error. Please check your connection and try again."
        } else {
          errorMessage = err.message || errorMessage
        }
      } else {
        errorMessage = String(err)
      }

      if (currentRequestId === requestIdRef.current) {
        const error = new Error(errorMessage)
        setError(error)
        setQuote(null)
        console.error("Refetch quote error:", error, {
          requestId: currentRequestId,
          tokenIn: getTokenSymbol(currentTokenIn),
          tokenOut: getTokenSymbol(currentTokenOut),
        })
      }
    } finally {
      clearTimeout(timeoutId)
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, []) // Empty deps - refetch is stable and always uses latest refs

  const fetchQuote = useCallback(async () => {
    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current

    // Capture current values to ensure we use the latest ones
    const currentTokenIn = tokenIn
    const currentTokenOut = tokenOut
    const currentAmountIn = amountIn
    const currentTradeType = tradeType
    const currentTokenList = tokenList

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Set fetching flag
    isFetchingRef.current = true
    abortControllerRef.current = new AbortController()

    // Validate token inputs
    if (!currentTokenIn || !currentTokenOut) {
      // Only clear if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setQuote(null)
        setError(null)
        setIsLoading(false)
      }
      return
    }

    // Check if tokens are the same (by address)
    if (currentTokenIn.address === currentTokenOut.address) {
      if (currentRequestId === requestIdRef.current) {
        setError(new Error("Cannot swap a token for itself. Please select different tokens."))
        setQuote(null)
        setIsLoading(false)
      }
      return
    }

    // Sanitize and validate amount input
    const amountInNum = sanitizeAmountInput(currentAmountIn)
    if (amountInNum === null || amountInNum <= 0) {
      if (currentRequestId === requestIdRef.current) {
        setQuote(null)
        setError(null)
        setIsLoading(false)
      }
      return
    }

    // Debug logging with timing
    const startTime = performance.now()
    console.log("[useQuote] Fetching quote:", {
      requestId: currentRequestId,
      tokenIn: getTokenSymbol(currentTokenIn),
      tokenOut: getTokenSymbol(currentTokenOut),
      amountIn: currentAmountIn,
      tradeType: currentTradeType,
      amountInNum,
      timestamp: startTime,
    })

    // Validate amount is not too large (prevent overflow)
    // Maximum safe value: 1e21 (1 billion tokens with 18 decimals)
    const MAX_AMOUNT = 1e21
    if (amountInNum > MAX_AMOUNT) {
      setError(new Error("Amount is too large. Please enter a smaller amount."))
      setQuote(null)
      setIsLoading(false)
      return
    }

    // Resolve token addresses using token resolver
    const tokenInAddress = resolveTokenAddress(currentTokenIn, currentTokenList)
    const tokenOutAddress = resolveTokenAddress(currentTokenOut, currentTokenList)

    if (!tokenInAddress || !tokenOutAddress) {
      const missingToken = !tokenInAddress ? currentTokenIn : currentTokenOut
      const tokenSymbol = getTokenSymbol(missingToken) || "Unknown"
      if (currentRequestId === requestIdRef.current) {
        setError(
          new Error(`Token address not found for ${tokenSymbol}. This token may not be supported.`)
        )
        setQuote(null)
        setIsLoading(false)
      }
      return
    }

    // Only proceed if this is still the latest request
    if (currentRequestId !== requestIdRef.current) {
      console.log(
        "[useQuote] Request outdated, aborting:",
        currentRequestId,
        "current:",
        requestIdRef.current
      )
      return
    }

    setIsLoading(true)
    setError(null)
    setNoLiquidity(false)

    // Request timeout (15 seconds)
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current && currentRequestId === requestIdRef.current) {
        abortControllerRef.current.abort()
      }
    }, 15000)

    try {
      // Resolve token decimals using token resolver
      const tokenInDecimals = resolveTokenDecimals(currentTokenIn, currentTokenList)
      const tokenOutDecimals = resolveTokenDecimals(currentTokenOut, currentTokenList)

      let bestQuote: {
        amountOut: bigint
        amountIn: bigint
        gasEstimate: bigint
        fee: number
      } | null = null

      // Try each RPC client and get best quote with parallel fee tier checking
      const clients = [createClient(FALLBACK_RPC_ENDPOINT)]
      let workingClient = clients[0] // Store the client that worked for spot price calculation

      for (const client of clients) {
        try {
          // Use parallel fee tier checking
          const quote = await getBestQuoteFromFeeTiers(
            client,
            tokenInAddress,
            tokenOutAddress,
            currentAmountIn,
            currentTradeType,
            tokenInDecimals,
            tokenOutDecimals
          )

          if (quote) {
            bestQuote = quote
            workingClient = client // Store the working client
            break // Found a working quote, no need to try other clients
          }
        } catch (clientError) {
          console.warn("RPC client error, trying next:", clientError)
        }
      }

      if (!bestQuote) {
        // Instead of throwing an error, set noLiquidity state
        if (currentRequestId === requestIdRef.current) {
          setNoLiquidity(true)
          setQuote(null)
          setError(null)
          console.log("[useQuote] No liquidity found:", {
            requestId: currentRequestId,
            tokenIn: getTokenSymbol(currentTokenIn),
            tokenOut: getTokenSymbol(currentTokenOut),
          })
        }
        return
      }

      // Check again if this is still the latest request before processing
      if (currentRequestId !== requestIdRef.current) {
        console.log(
          "[useQuote] Request outdated before processing result:",
          currentRequestId,
          "current:",
          requestIdRef.current
        )
        return
      }

      // Calculate formatted amounts
      const amountOutRaw = formatUnits(bestQuote.amountOut, tokenOutDecimals)
      const amountOutNum = parseFloat(amountOutRaw)
      const amountInRaw = formatUnits(bestQuote.amountIn, tokenInDecimals)
      const amountInNum = parseFloat(amountInRaw)

      // Format based on token type (stablecoins get 2 decimals, others get 6)
      const tokenOutSymbol = getTokenSymbol(currentTokenOut) || ""
      const tokenInSymbol = getTokenSymbol(currentTokenIn) || ""
      const amountOutFormatted = formatTokenAmount(amountOutNum, tokenOutSymbol)
      const amountInFormatted = formatTokenAmount(amountInNum, tokenInSymbol)

      // Calculate minOut/maxIn based on slippage (with validation)
      const slippagePercent = validateSlippage(slippage)
      const slippageBps = BigInt(Math.floor(slippagePercent * 100)) // Convert to basis points

      let minOut: bigint
      let minOutFormatted: string

      if (currentTradeType === "exactIn") {
        // For exact input: minOut = amountOut * (1 - slippage/100)
        minOut = (bestQuote.amountOut * (BigInt(10000) - slippageBps)) / BigInt(10000)
        const minOutNum = parseFloat(formatUnits(minOut, tokenOutDecimals))
        minOutFormatted = formatTokenAmount(minOutNum, tokenOutSymbol)
      } else {
        // For exact output: maxIn = amountIn * (1 + slippage/100)
        minOut = (bestQuote.amountIn * (BigInt(10000) + slippageBps)) / BigInt(10000)
        const minOutNum = parseFloat(formatUnits(minOut, tokenInDecimals))
        minOutFormatted = formatTokenAmount(minOutNum, tokenInSymbol)
      }

      // Calculate exchange rate (always output/input)
      const exchangeRate = amountOutNum / amountInNum

      // Calculate price impact by comparing execution price to spot price
      // Fetch spot price using a very small amount (1 wei equivalent)
      let priceImpact = 0
      try {
        const spotAmountIn = parseUnits("0.000001", tokenInDecimals) // Very small amount for spot price
        const spotResult = await workingClient.simulateContract({
          address: QUOTER_V2_ADDRESS,
          abi: QUOTER_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: tokenInAddress,
              tokenOut: tokenOutAddress,
              amountIn: spotAmountIn,
              fee: bestQuote.fee, // Use same fee tier as best quote
              sqrtPriceLimitX96: BigInt(0),
            },
          ],
        })

        const [spotAmountOut] = spotResult.result as [bigint, bigint, number, bigint]
        const spotAmountOutNum = parseFloat(formatUnits(spotAmountOut, tokenOutDecimals))
        const spotAmountInNum = parseFloat(formatUnits(spotAmountIn, tokenInDecimals))
        const spotPrice = spotAmountOutNum / spotAmountInNum

        // Execution price is the exchange rate we calculated
        const executionPrice = exchangeRate

        // Calculate price impact: (executionPrice - spotPrice) / spotPrice * 100
        if (spotPrice > 0) {
          priceImpact = ((executionPrice - spotPrice) / spotPrice) * 100
        }
      } catch (spotError) {
        // If spot price fetch fails, fall back to rough estimate
        console.debug("Failed to fetch spot price, using estimate:", spotError)
        const tradeAmount = currentTradeType === "exactIn" ? amountInNum : amountOutNum
        priceImpact = -0.01 * Math.log10(tradeAmount + 1)
      }

      // Cap price impact at reasonable bounds
      priceImpact = Math.max(Math.min(priceImpact, 0), -50) // Between 0% and -50%

      // Create new quote object to ensure state update
      const newQuote: QuoteResult = {
        amountOut: bestQuote.amountOut,
        amountOutFormatted,
        amountIn: bestQuote.amountIn,
        amountInFormatted,
        minOut,
        minOutFormatted,
        priceImpact,
        exchangeRate,
        gasEstimate: bestQuote.gasEstimate,
        fee: bestQuote.fee,
      }

      // Only set quote if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        const endTime = performance.now()
        const duration = endTime - startTime
        // Debug logging
        console.log("[useQuote] Quote result:", {
          requestId: currentRequestId,
          tokenIn: getTokenSymbol(currentTokenIn),
          tokenOut: getTokenSymbol(currentTokenOut),
          tradeType: currentTradeType,
          amountIn: currentAmountIn,
          amountInFormatted: newQuote.amountInFormatted,
          amountOutFormatted: newQuote.amountOutFormatted,
          amountInNum,
          amountOutNum,
          tokenInDecimals,
          tokenOutDecimals,
          duration: `${duration.toFixed(2)}ms`,
        })

        // Compare new vs old quote to prevent unnecessary re-renders
        const isIdentical =
          prevQuoteRef.current?.amountOut === newQuote.amountOut &&
          prevQuoteRef.current?.fee === newQuote.fee &&
          prevQuoteRef.current?.amountIn === newQuote.amountIn

        if (isIdentical) {
          setIsLoading(false)
          return // BREAK THE LOOP: Do not update state if the quote is the same
        }

        prevQuoteRef.current = newQuote
        setQuote(newQuote)
        setError(null)
      } else {
        console.log(
          "[useQuote] Ignoring stale quote:",
          currentRequestId,
          "current:",
          requestIdRef.current
        )
      }
    } catch (err) {
      let errorMessage = "Failed to fetch quote"

      if (err instanceof Error) {
        // Check for specific error types
        if (err.message.includes("aborted") || err.name === "AbortError") {
          errorMessage = "Quote request was cancelled"
        } else if (err.message.includes("timeout") || err.message.includes("time")) {
          errorMessage = "Quote request timed out. Please try again."
        } else if (err.message.includes("liquidity")) {
          errorMessage = err.message
        } else if (err.message.includes("network") || err.message.includes("fetch")) {
          errorMessage = "Network error. Please check your connection and try again."
        } else {
          errorMessage = err.message || errorMessage
        }
      } else {
        errorMessage = String(err)
      }

      // Only set error if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        const error = new Error(errorMessage)
        setError(error)
        setQuote(null)
        console.error("Quote fetch error:", error, {
          requestId: currentRequestId,
          tokenIn: getTokenSymbol(currentTokenIn),
          tokenOut: getTokenSymbol(currentTokenOut),
        })
      }
    } finally {
      clearTimeout(timeoutId)
      // Only update loading state if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false)
      }
      // Clear fetching flag
      isFetchingRef.current = false
    }
  }, [tokenIn?.address, tokenOut?.address, amountIn, slippage, tradeType, tokenList])

  // Main fetch effect - handles all quote fetching logic
  useEffect(() => {
    if (!enabled || !tokenIn?.address || !tokenOut?.address || !amountIn) {
      if (!amountIn) setQuote(null)
      return
    }

    // Use a string-based key to check if the input "intent" has actually changed
    const inputKey = `${tokenIn.address}-${tokenOut.address}-${amountIn}-${tradeType}`
    if (lastInputKeyRef.current === inputKey) return

    lastInputKeyRef.current = inputKey

    // Determine if this is a structural change (tokens/type) or just typing (amount)
    const isStructuralChange =
      prevTokenInRef.current?.address !== tokenIn?.address ||
      prevTokenOutRef.current?.address !== tokenOut?.address ||
      prevTradeTypeRef.current !== tradeType

    // Clear any existing debounce timer
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // PERFORMANCE FIX:
    // Never fetch "instantly". Even for token switches, wait 100ms
    // to let the 'click' handler and React render finish.
    const delay = isStructuralChange ? 400 : debounceMs

    debounceRef.current = setTimeout(() => {
      // We use refetch() here because it uses the latest Refs
      // and is more robust against stale closures
      refetch()
    }, delay)

    // Update tracking refs
    prevTokenInRef.current = tokenIn
    prevTokenOutRef.current = tokenOut
    prevAmountInRef.current = amountIn
    prevTradeTypeRef.current = tradeType

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [tokenIn?.address, tokenOut?.address, amountIn, tradeType, enabled, debounceMs, refetch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    quote,
    isLoading,
    error,
    noLiquidity,
    refetch, // Use the stable refetch function that always works
  }
}

/**
 * Format a number to a reasonable display precision
 */
export function formatQuoteAmount(amount: string, maxDecimals: number = 6): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return "0"

  if (num === 0) return "0"
  if (num < 0.000001) return "<0.000001"
  if (num < 1) return num.toFixed(maxDecimals).replace(/\.?0+$/, "")
  if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, "")
  if (num < 1000000) return num.toFixed(2).replace(/\.?0+$/, "")

  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Format price impact for display
 */
export function formatPriceImpact(impact: number): string {
  const absImpact = Math.abs(impact)
  if (absImpact < 0.01) return "<0.01%"
  return `${impact >= 0 ? "" : "-"}${absImpact.toFixed(2)}%`
}

/**
 * Get price impact severity for styling
 */
export function getPriceImpactSeverity(impact: number): "low" | "medium" | "high" {
  const absImpact = Math.abs(impact)
  if (absImpact < 1) return "low"
  if (absImpact < 3) return "medium"
  return "high"
}
