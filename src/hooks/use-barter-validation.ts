"use client"

import { useEffect, useRef, useState } from "react"
import { parseUnits } from "viem"
import { fetchBarterRoute } from "@/lib/barter-api"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"

const DEBOUNCE_MS = 300
/**
 * Delay before retrying a failed `/route` call within the same validation cycle.
 * Chosen short enough that a single transient blip (one 500 response, one TCP
 * reset) is absorbed without any UI flicker — the retry finishes inside the
 * same implicit loading window. Long enough to avoid hammering Barter on a
 * sustained outage.
 */
const RETRY_DELAY_MS = 800
/**
 * Consecutive errors (initial attempt + retries) required to flip
 * `barterUnavailable` to true. At 2 we absorb a single blip but block on a real
 * outage quickly — the caller gates swap submission on this flag, and leaving
 * it off would let users sign intents with a Uniswap-anchored floor on pairs
 * where the quote-guard needs Barter to fire correctly.
 */
const UNAVAILABLE_ERROR_THRESHOLD = 2

interface UseBarterValidationParams {
  fromToken: Token | undefined
  toToken: Token | undefined
  /** Uniswap amountOut in wei (bigint) */
  amountOut: bigint | undefined
  /** Sell amount (human-readable, e.g. "0.01") */
  sellAmount: string
  /** Monotonic counter — increments on each Uniswap requote so we re-validate even when amountOut is unchanged */
  quoteGeneration: number
  /**
   * User's current slippage tolerance in percent (e.g. 2, 5, 50). amountTooSmall
   * is derived from this — raising the tolerance re-evaluates the cached shortfall
   * instantly without a new Barter API call.
   */
  maxSlippagePct: number
  enabled: boolean
}

interface UseBarterValidationReturn {
  /** True when observed Barter shortfall exceeds the user's current slippage tolerance */
  amountTooSmall: boolean
  /** Observed shortfall percentage between Uniswap quote and Barter output (0 when unknown) */
  shortfallPct: number
  /** True while validation hasn't completed for current inputs (debounce + fetch) */
  isValidating: boolean
  /** Barter's routed output amount (wei). Undefined until first successful fetch for current inputs. */
  barterAmountOut: bigint | undefined
  /**
   * True when Barter's /route endpoint has failed for the current inputs at least
   * UNAVAILABLE_ERROR_THRESHOLD times in a row. Callers should block swap submission
   * while this is true — without Barter data the quote-guard can't fire, which on
   * thin-pool pairs re-introduces the surplus-leak bug the guard was added to fix.
   */
  barterUnavailable: boolean
}

/**
 * Validates that Barter can route the current swap within the max slippage cap.
 * Calls Barter's /route endpoint with the sell amount, compares the returned
 * outputAmount against the Uniswap quote, and flags when the shortfall exceeds 2%.
 *
 * Errors from `/route` are retried once within the same validation cycle. If the
 * retry also fails, `barterUnavailable` flips so the caller can block the swap
 * button until the next successful validation clears it.
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
  maxSlippagePct,
  enabled,
}: UseBarterValidationParams): UseBarterValidationReturn {
  const [shortfallPct, setShortfallPct] = useState(0)
  const [settled, setSettled] = useState(true)
  const [barterAmountOut, setBarterAmountOut] = useState<bigint | undefined>(undefined)
  const [barterUnavailable, setBarterUnavailable] = useState(false)
  const requestIdRef = useRef(0)

  // quoteGeneration is included so a requote that returns the same amountOut still triggers re-validation
  const inputKey = enabled
    ? `${fromToken?.address}|${toToken?.address}|${sellAmount}|${amountOut?.toString()}|${quoteGeneration}`
    : ""
  const lastSettledKeyRef = useRef(inputKey)

  useEffect(() => {
    // Reset when disabled or missing inputs
    if (!enabled || !fromToken || !toToken || !amountOut || amountOut === 0n) {
      setShortfallPct(0)
      setBarterAmountOut(undefined)
      setBarterUnavailable(false)
      setSettled(true)
      lastSettledKeyRef.current = ""
      requestIdRef.current++
      return
    }

    const sellClean = sellAmount?.replace(/,/g, "").trim()
    if (!sellClean || parseFloat(sellClean) <= 0) {
      setShortfallPct(0)
      setBarterAmountOut(undefined)
      setBarterUnavailable(false)
      setSettled(true)
      lastSettledKeyRef.current = ""
      requestIdRef.current++
      return
    }

    // Inputs changed — mark unsettled immediately (no gap for swap button to flash)
    lastSettledKeyRef.current = inputKey
    setSettled(false)
    setShortfallPct(0)
    setBarterAmountOut(undefined)
    // Do NOT reset barterUnavailable here — if we're in an outage, leaving it true
    // across input changes avoids "swap button enables for 300ms then blocks again"
    // flicker. Successful validation below clears it.
    const currentRequest = ++requestIdRef.current

    const isEthInput = fromToken.address === ZERO_ADDRESS
    const source = isEthInput
      ? (WETH_ADDRESS as `0x${string}`)
      : (fromToken.address as `0x${string}`)
    const target = toToken.address as `0x${string}`
    const sellAmtWei = parseUnits(sellClean, fromToken.decimals).toString()

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const attempt = async (consecutiveFailures: number): Promise<void> => {
      try {
        const route = await fetchBarterRoute(source, target, sellAmtWei, isEthInput)

        if (cancelled || currentRequest !== requestIdRef.current) return

        const barterOut = BigInt(route.outputAmount)
        const shortfall =
          amountOut > 0n ? Number(((amountOut - barterOut) * 10000n) / amountOut) / 100 : 0

        setBarterAmountOut(barterOut)
        setShortfallPct(Math.max(0, shortfall))
        setBarterUnavailable(false)
        setSettled(true)
      } catch {
        if (cancelled || currentRequest !== requestIdRef.current) return

        const failures = consecutiveFailures + 1
        if (failures >= UNAVAILABLE_ERROR_THRESHOLD) {
          // Sustained outage — block the swap button, clear any stale Barter data,
          // and mark settled so the UI stops spinning.
          setBarterAmountOut(undefined)
          setShortfallPct(0)
          setBarterUnavailable(true)
          setSettled(true)
          return
        }

        // First failure — silently retry once. Keep `settled=false` so the swap
        // button stays in the loading state and doesn't briefly enable on a
        // transient blip.
        retryTimer = setTimeout(() => {
          if (!cancelled && currentRequest === requestIdRef.current) {
            void attempt(failures)
          }
        }, RETRY_DELAY_MS)
      }
    }

    const debounceTimer = setTimeout(() => {
      void attempt(0)
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(debounceTimer)
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [fromToken, toToken, amountOut, sellAmount, quoteGeneration, enabled, inputKey])

  // Derive amountTooSmall from cached shortfall + live slippage tolerance.
  // This lets the gate re-evaluate instantly when the user bumps their slippage
  // (no extra Barter API call, no "calculating" flicker) while still accurately
  // reflecting whether the current tolerance covers the measured shortfall.
  const amountTooSmall = settled && shortfallPct > 0 && shortfallPct > maxSlippagePct

  return {
    amountTooSmall,
    shortfallPct,
    isValidating: !settled,
    barterAmountOut,
    barterUnavailable,
  }
}
