"use client"

import { useEffect, useRef, useState } from "react"
import { parseUnits } from "viem"
import { fetchBarterRoute } from "@/lib/barter-api"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"

const DEBOUNCE_MS = 300
const MAX_SLIPPAGE_PCT = 2.0

interface UseBarterValidationParams {
  fromToken: Token | undefined
  toToken: Token | undefined
  /** Uniswap amountOut in wei (bigint) */
  amountOut: bigint | undefined
  /** Sell amount (human-readable, e.g. "0.01") */
  sellAmount: string
  /** Monotonic counter — increments on each Uniswap requote so we re-validate even when amountOut is unchanged */
  quoteGeneration: number
  enabled: boolean
}

interface UseBarterValidationReturn {
  /** True when the amount is too small for Barter to route within 2% slippage */
  amountTooSmall: boolean
  /** Observed shortfall percentage between Uniswap quote and Barter output (0 when unknown) */
  shortfallPct: number
  /** True while validation hasn't completed for current inputs (debounce + fetch) */
  isValidating: boolean
  /** Barter's routed output amount (wei). Undefined until first successful fetch for current inputs. */
  barterAmountOut: bigint | undefined
}

/**
 * Validates that Barter can route the current swap within the max slippage cap.
 * Calls Barter's /route endpoint with the sell amount, compares the returned
 * outputAmount against the Uniswap quote, and flags when the shortfall exceeds 2%.
 *
 * `isValidating` stays true from when inputs change until the result arrives,
 * covering both the debounce period and the network request — no flicker gap.
 */
export function useBarterValidation({
  fromToken,
  toToken,
  amountOut,
  sellAmount,
  quoteGeneration,
  enabled,
}: UseBarterValidationParams): UseBarterValidationReturn {
  const [amountTooSmall, setAmountTooSmall] = useState(false)
  const [shortfallPct, setShortfallPct] = useState(0)
  const [settled, setSettled] = useState(true)
  const [barterAmountOut, setBarterAmountOut] = useState<bigint | undefined>(undefined)
  const requestIdRef = useRef(0)

  // quoteGeneration is included so a requote that returns the same amountOut still triggers re-validation
  const inputKey = enabled
    ? `${fromToken?.address}|${toToken?.address}|${sellAmount}|${amountOut?.toString()}|${quoteGeneration}`
    : ""
  const lastSettledKeyRef = useRef(inputKey)

  useEffect(() => {
    // Reset when disabled or missing inputs
    if (!enabled || !fromToken || !toToken || !amountOut || amountOut === 0n) {
      setAmountTooSmall(false)
      setShortfallPct(0)
      setBarterAmountOut(undefined)
      setSettled(true)
      lastSettledKeyRef.current = ""
      requestIdRef.current++
      return
    }

    const sellClean = sellAmount?.replace(/,/g, "").trim()
    if (!sellClean || parseFloat(sellClean) <= 0) {
      setAmountTooSmall(false)
      setShortfallPct(0)
      setBarterAmountOut(undefined)
      setSettled(true)
      lastSettledKeyRef.current = ""
      requestIdRef.current++
      return
    }

    // Inputs changed — mark unsettled immediately (no gap for swap button to flash)
    lastSettledKeyRef.current = inputKey
    setSettled(false)
    setAmountTooSmall(false)
    setShortfallPct(0)
    setBarterAmountOut(undefined)
    const currentRequest = ++requestIdRef.current

    const timer = setTimeout(async () => {
      try {
        const source =
          fromToken.address === ZERO_ADDRESS
            ? (WETH_ADDRESS as `0x${string}`)
            : (fromToken.address as `0x${string}`)
        const target = toToken.address as `0x${string}`
        const sellAmtWei = parseUnits(sellClean, fromToken.decimals).toString()

        const route = await fetchBarterRoute(source, target, sellAmtWei)

        if (currentRequest !== requestIdRef.current) return

        const barterOut = BigInt(route.outputAmount)
        const shortfall =
          amountOut > 0n ? Number(((amountOut - barterOut) * 10000n) / amountOut) / 100 : 0

        setBarterAmountOut(barterOut)
        setShortfallPct(Math.max(0, shortfall))
        setAmountTooSmall(shortfall > MAX_SLIPPAGE_PCT)
      } catch {
        // Network errors should NOT flip the flag — keep whatever state we
        // had before so the UI doesn't flicker "swap too small" on transient
        // failures.  The next successful validation will set the correct value.
      } finally {
        if (currentRequest === requestIdRef.current) {
          setSettled(true)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [fromToken, toToken, amountOut, sellAmount, quoteGeneration, enabled, inputKey])

  return { amountTooSmall, shortfallPct, isValidating: !settled, barterAmountOut }
}
