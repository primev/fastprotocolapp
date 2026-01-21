"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createPublicClient, http, parseUnits, formatUnits, type Address } from "viem"
import { mainnet } from "wagmi/chains"
import { RPC_ENDPOINT, FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"
import { sanitizeAmountInput, formatTokenAmount } from "@/lib/utils"
import { resolveTokenAddress, resolveTokenDecimals, getTokenSymbol } from "@/lib/token-resolver"
import type { Token } from "@/types/swap"

// Uniswap V3 Quoter V2 on Ethereum mainnet
const QUOTER_V2_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const

// Uniswap V3 Quoter V2 ABI (supports both exact input and exact output)
const QUOTER_V2_ABI = [
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
  refetch: () => Promise<void>
}

// Create public client for RPC calls
function createClient(rpcUrl: string) {
  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, {
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

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0) // Track request IDs to prevent stale quotes

  // Memoize inputs to prevent unnecessary refetches
  // Use token addresses for comparison instead of symbols
  const tokenInKey = tokenIn ? `${tokenIn.address}-${tokenIn.symbol}` : ""
  const tokenOutKey = tokenOut ? `${tokenOut.address}-${tokenOut.symbol}` : ""
  const inputKey = useMemo(
    () => `${tokenInKey}-${tokenOutKey}-${amountIn}-${slippage}-${tradeType}`,
    [tokenInKey, tokenOutKey, amountIn, slippage, tradeType]
  )

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

    // Debug logging
    console.log("[useQuote] Fetching quote:", {
      requestId: currentRequestId,
      tokenIn: getTokenSymbol(currentTokenIn),
      tokenOut: getTokenSymbol(currentTokenOut),
      amountIn: currentAmountIn,
      tradeType: currentTradeType,
      amountInNum,
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

      // Try each fee tier and pick the best quote
      const clients = [createClient(FALLBACK_RPC_ENDPOINT)]
      let workingClient = clients[0] // Store the client that worked for spot price calculation

      for (const client of clients) {
        try {
          for (const fee of FEE_TIERS) {
            try {
              let result

              if (currentTradeType === "exactIn") {
                // Exact input: we know amountIn, calculate amountOut
                const amountInWei = parseUnits(currentAmountIn, tokenInDecimals)
                result = await client.simulateContract({
                  address: QUOTER_V2_ADDRESS,
                  abi: QUOTER_V2_ABI,
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

                const [amountOut, , , gasEstimate] = result.result as [
                  bigint,
                  bigint,
                  number,
                  bigint,
                ]

                if (!bestQuote || amountOut > bestQuote.amountOut) {
                  bestQuote = { amountOut, amountIn: amountInWei, gasEstimate, fee }
                  workingClient = client // Store the working client
                }
              } else {
                // Exact output: we know amountOut (from amountIn), calculate amountIn needed
                // IMPORTANT: amountIn parameter represents the desired OUTPUT amount in exactOut mode
                const amountOutWei = parseUnits(currentAmountIn, tokenOutDecimals)
                result = await client.simulateContract({
                  address: QUOTER_V2_ADDRESS,
                  abi: QUOTER_V2_ABI,
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

                const [amountInWei, , , gasEstimate] = result.result as [
                  bigint,
                  bigint,
                  number,
                  bigint,
                ]

                if (!bestQuote || amountInWei < bestQuote.amountIn) {
                  bestQuote = { amountOut: amountOutWei, amountIn: amountInWei, gasEstimate, fee }
                  workingClient = client // Store the working client
                }
              }
            } catch (feeError) {
              // This fee tier might not have a pool, continue to next
              console.debug(`No pool for fee tier ${fee}:`, feeError)
            }
          }

          if (bestQuote) break // Got a quote, no need to try fallback RPC
        } catch (clientError) {
          console.warn("RPC client error, trying next:", clientError)
        }
      }

      if (!bestQuote) {
        const tokenInSymbol = getTokenSymbol(currentTokenIn) || "Unknown"
        const tokenOutSymbol = getTokenSymbol(currentTokenOut) || "Unknown"
        throw new Error(
          `No liquidity found for ${tokenInSymbol}/${tokenOutSymbol} pair. This pair may not have an active pool.`
        )
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
          abi: QUOTER_V2_ABI,
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
        })

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
    }
  }, [tokenIn, tokenOut, amountIn, slippage, tradeType, tokenList])

  // Clear quote when key inputs change significantly (token changes)
  const prevTokenInKeyRef = useRef(tokenInKey)
  const prevTokenOutKeyRef = useRef(tokenOutKey)
  const prevTradeTypeRef = useRef(tradeType)
  const prevTokenKeysForFetchRef = useRef({ tokenInKey, tokenOutKey })

  useEffect(() => {
    // If tokens or trade type changed, clear the quote immediately to prevent stale data
    const tokensChanged =
      prevTokenInKeyRef.current !== tokenInKey || prevTokenOutKeyRef.current !== tokenOutKey
    const tradeTypeChanged = prevTradeTypeRef.current !== tradeType

    if (tokensChanged || tradeTypeChanged) {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }

      setQuote(null)
      setError(null)
      setIsLoading(false)
    }

    // Always update refs to track current state
    prevTokenInKeyRef.current = tokenInKey
    prevTokenOutKeyRef.current = tokenOutKey
    prevTradeTypeRef.current = tradeType
  }, [tokenInKey, tokenOutKey, tradeType])

  // Debounced fetch
  useEffect(() => {
    if (!enabled) {
      // Preserve previous quote when disabled (e.g., during switch) to prevent UI flicker
      // Don't setQuote(null) - keep the existing quote state
      return
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    // Set loading state immediately for UX feedback
    if (amountIn && parseFloat(amountIn) > 0) {
      setIsLoading(true)
    }

    // Check if tokens changed by comparing current keys with previous refs
    // Use separate refs to avoid race condition with the clear quote effect
    const tokensChanged =
      prevTokenKeysForFetchRef.current.tokenInKey !== tokenInKey ||
      prevTokenKeysForFetchRef.current.tokenOutKey !== tokenOutKey

    if (tokensChanged) {
      // Tokens changed - fetch immediately (no debounce)
      // Update refs now so next render knows tokens have changed
      prevTokenKeysForFetchRef.current = { tokenInKey, tokenOutKey }
      fetchQuote()
    } else {
      // Amount or other input changed - use debounce
      prevTokenKeysForFetchRef.current = { tokenInKey, tokenOutKey }
      debounceRef.current = setTimeout(() => {
        fetchQuote()
      }, debounceMs)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [inputKey, enabled, debounceMs, fetchQuote, tokenInKey, tokenOutKey])

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
    refetch: fetchQuote,
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
