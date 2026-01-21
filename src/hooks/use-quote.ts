"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createPublicClient, http, parseUnits, formatUnits, type Address } from "viem"
import { mainnet } from "wagmi/chains"
import { RPC_ENDPOINT, FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"
import { sanitizeAmountInput, formatTokenAmount } from "@/lib/utils"

// Uniswap V3 Quoter V2 on Ethereum mainnet
const QUOTER_V2_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const

// Common token addresses on mainnet
export const TOKEN_ADDRESSES: Record<string, Address> = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Placeholder for native ETH
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeCB5e",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
}

// Token decimals
export const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  WETH: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
  WBTC: 8,
  LINK: 18,
  UNI: 18,
  AAVE: 18,
  // TODO: Uncomment when FAST token is available
  // FAST: 18,
}

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
  tokenIn: string
  tokenOut: string
  amountIn: string
  slippage: string // e.g., "0.5" for 0.5%
  enabled?: boolean
  debounceMs?: number
  tradeType?: TradeType // "exactIn" when typing sell amount, "exactOut" when typing buy amount
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

// Get token address, treating ETH as WETH for quoting
function getTokenAddress(symbol: string): Address | null {
  if (symbol === "ETH") {
    return TOKEN_ADDRESSES.WETH
  }
  return TOKEN_ADDRESSES[symbol] || null
}

// Get token decimals
function getTokenDecimals(symbol: string): number {
  return TOKEN_DECIMALS[symbol] || 18
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
}: UseQuoteProps): UseQuoteReturn {
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Memoize inputs to prevent unnecessary refetches
  const inputKey = useMemo(
    () => `${tokenIn}-${tokenOut}-${amountIn}-${slippage}-${tradeType}`,
    [tokenIn, tokenOut, amountIn, slippage, tradeType]
  )

  const fetchQuote = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // Validate token inputs
    if (!tokenIn || !tokenOut || tokenIn === tokenOut) {
      setQuote(null)
      setError(null)
      return
    }

    // Sanitize and validate amount input
    const amountInNum = sanitizeAmountInput(amountIn)
    if (amountInNum === null || amountInNum <= 0) {
      setQuote(null)
      setError(null)
      return
    }

    const tokenInAddress = getTokenAddress(tokenIn)
    const tokenOutAddress = getTokenAddress(tokenOut)

    if (!tokenInAddress || !tokenOutAddress) {
      // For tokens we don't have addresses for (like FAST), use mock quote
      const mockRate = tokenIn === "ETH" ? 2300 : tokenOut === "ETH" ? 1 / 2300 : 1
      const slippagePercent = parseFloat(slippage) || 0.5

      let amountOut: bigint
      let amountOutFormatted: string
      let amountIn: bigint
      let amountInFormatted: string
      let minOut: bigint
      let minOutFormatted: string

      if (tradeType === "exactIn") {
        // Lead is SELL box: we know amountIn (what user typed), calculate amountOut
        const calculatedOut = amountInNum * mockRate
        amountIn = BigInt(Math.floor(amountInNum * 1e18))
        amountInFormatted = formatTokenAmount(amountInNum, tokenIn)
        amountOut = BigInt(Math.floor(calculatedOut * 1e18))
        amountOutFormatted = formatTokenAmount(calculatedOut, tokenOut)
        const minOutNum = calculatedOut * (1 - slippagePercent / 100)
        minOut = BigInt(Math.floor(minOutNum * 1e18))
        minOutFormatted = formatTokenAmount(minOutNum, tokenOut)
      } else {
        // Lead is BUY box: amountInNum is the desired OUTPUT (what user typed)
        // Calculate how much INPUT we need to get that output
        const calculatedIn = amountInNum / mockRate
        amountIn = BigInt(Math.floor(calculatedIn * 1e18))
        amountInFormatted = formatTokenAmount(calculatedIn, tokenIn)
        amountOut = BigInt(Math.floor(amountInNum * 1e18))
        amountOutFormatted = formatTokenAmount(amountInNum, tokenOut) // The number typed is the target
        // For exact output, maxIn is amountIn * (1 + slippage/100)
        const maxInNum = calculatedIn * (1 + slippagePercent / 100)
        minOut = BigInt(Math.floor(maxInNum * 1e18))
        minOutFormatted = formatTokenAmount(maxInNum, tokenIn)
      }

      setQuote({
        amountOut,
        amountOutFormatted,
        amountIn,
        amountInFormatted,
        minOut,
        minOutFormatted,
        priceImpact: -0.01, // Mock small impact
        exchangeRate: mockRate,
        gasEstimate: BigInt(150000),
        fee: 3000,
      })
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const tokenInDecimals = getTokenDecimals(tokenIn)
      const tokenOutDecimals = getTokenDecimals(tokenOut)

      let bestQuote: {
        amountOut: bigint
        amountIn: bigint
        gasEstimate: bigint
        fee: number
      } | null = null

      // Try each fee tier and pick the best quote
      const clients = [createClient(FALLBACK_RPC_ENDPOINT)]

      for (const client of clients) {
        try {
          for (const fee of FEE_TIERS) {
            try {
              let result

              if (tradeType === "exactIn") {
                // Exact input: we know amountIn, calculate amountOut
                const amountInWei = parseUnits(amountIn, tokenInDecimals)
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
                }
              } else {
                // Exact output: we know amountOut (from amountIn), calculate amountIn needed
                const amountOutWei = parseUnits(amountIn, tokenOutDecimals)
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
        throw new Error("No liquidity found for this pair")
      }

      // Calculate formatted amounts
      const amountOutRaw = formatUnits(bestQuote.amountOut, tokenOutDecimals)
      const amountOutNum = parseFloat(amountOutRaw)
      const amountInRaw = formatUnits(bestQuote.amountIn, tokenInDecimals)
      const amountInNum = parseFloat(amountInRaw)

      // Format based on token type (stablecoins get 2 decimals, others get 6)
      const amountOutFormatted = formatTokenAmount(amountOutNum, tokenOut)
      const amountInFormatted = formatTokenAmount(amountInNum, tokenIn)

      // Calculate minOut/maxIn based on slippage (with validation)
      const slippagePercent = validateSlippage(slippage)
      const slippageBps = BigInt(Math.floor(slippagePercent * 100)) // Convert to basis points

      let minOut: bigint
      let minOutFormatted: string

      if (tradeType === "exactIn") {
        // For exact input: minOut = amountOut * (1 - slippage/100)
        minOut = (bestQuote.amountOut * (BigInt(10000) - slippageBps)) / BigInt(10000)
        const minOutNum = parseFloat(formatUnits(minOut, tokenOutDecimals))
        minOutFormatted = formatTokenAmount(minOutNum, tokenOut)
      } else {
        // For exact output: maxIn = amountIn * (1 + slippage/100)
        minOut = (bestQuote.amountIn * (BigInt(10000) + slippageBps)) / BigInt(10000)
        const minOutNum = parseFloat(formatUnits(minOut, tokenInDecimals))
        minOutFormatted = formatTokenAmount(minOutNum, tokenIn)
      }

      // Calculate exchange rate (always output/input)
      const exchangeRate = amountOutNum / amountInNum

      // Estimate price impact (simplified - comparing to spot price would require additional call)
      // For now, estimate based on trade size relative to typical pool liquidity
      const tradeAmount = tradeType === "exactIn" ? amountInNum : amountOutNum
      const priceImpact = -0.01 * Math.log10(tradeAmount + 1) // Rough estimate

      // Create new quote object to ensure state update
      const newQuote: QuoteResult = {
        amountOut: bestQuote.amountOut,
        amountOutFormatted,
        amountIn: bestQuote.amountIn,
        amountInFormatted,
        minOut,
        minOutFormatted,
        priceImpact: Math.max(priceImpact, -5), // Cap at -5%
        exchangeRate,
        gasEstimate: bestQuote.gasEstimate,
        fee: bestQuote.fee,
      }

      setQuote(newQuote)
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setQuote(null)
      console.error("Quote fetch error:", error)
    } finally {
      setIsLoading(false)
    }
  }, [tokenIn, tokenOut, amountIn, slippage, tradeType])

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
    }

    // Set loading state immediately for UX feedback
    if (amountIn && parseFloat(amountIn) > 0) {
      setIsLoading(true)
    }

    debounceRef.current = setTimeout(() => {
      fetchQuote()
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [inputKey, enabled, debounceMs]) // Removed fetchQuote - inputKey already captures all dependencies

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
