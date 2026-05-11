"use client"

import { useEffect, useRef, useState } from "react"
import { parseUnits } from "viem"
import { fetchBarterRoute } from "@/lib/barter-api"
import { reportClientError } from "@/lib/report-client-error"
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

/**
 * Maximum |shortfall%| we'll accept as a real barter routing observation.
 * Anything above this is treated as either:
 *   - a stale-quote artifact (e.g. mid-token-switch where amountOut is still
 *     the previous pair's bigint while barterOut is the new pair's), or
 *   - a swap so small that gas eats most of the output and the swap can't be
 *     auto-covered by widening slippage in any meaningful way.
 *
 * Lowered from 90 → 50: real barter routing rarely deviates more than ~30%
 * from uniswap, and the lower threshold catches the gas-eats-output regime
 * earlier so the user sees an explicit "swap too small" warning instead of
 * the previously-silent auto-bump-to-50%.
 */
const SANITY_GATE_PCT = 50

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
  /** True while the uniswap quote is in flight. When set, the validator
   *  defers its API call: with `sellAmount` updating synchronously but
   *  `amountOut` only updating after the quote refetch, firing the
   *  validator before the quote settles produces a stale comparison
   *  (fresh barter for the new size vs uniswap output for the prior size).
   *  That stale comparison can manufacture a 40-50% shortfall that the
   *  ratchet then locks in — visible as auto rails to 50% after rapid
   *  amount toggles. */
  isQuoteLoading?: boolean
}

interface UseBarterValidationReturn {
  /** True when observed Barter shortfall exceeds the user's current slippage tolerance */
  amountTooSmall: boolean
  /** Observed shortfall percentage between Uniswap quote and Barter output (0 when unknown) */
  shortfallPct: number
  /** True while validation hasn't completed for current inputs (debounce + fetch) */
  isValidating: boolean
  /**
   * Barter's path-adjusted output (post-gas on permit path, pre-gas on ETH path).
   * Used by the quote-guard floor and `amountTooSmall` gate — represents what the
   * user actually receives.
   */
  barterAmountOut: bigint | undefined
  /**
   * Barter's pre-gas routing output regardless of path. Used by the miles
   * estimator to compute `surplus = barterPreGasOutputAmount - userAmtOut`,
   * which mirrors how the FastSettlement contract retains surplus on-chain.
   * Falls back to `barterAmountOut` when the proxy doesn't return a separate
   * value (older deployment, or ETH path where they're equal).
   */
  barterPreGasOutputAmount: bigint | undefined
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
  isQuoteLoading = false,
}: UseBarterValidationParams): UseBarterValidationReturn {
  const [shortfallPct, setShortfallPct] = useState(0)
  const [settled, setSettled] = useState(true)
  const [barterAmountOut, setBarterAmountOut] = useState<bigint | undefined>(undefined)
  const [barterPreGasOutputAmount, setBarterPreGasOutputAmount] = useState<bigint | undefined>(
    undefined
  )
  const [barterUnavailable, setBarterUnavailable] = useState(false)
  /**
   * True when the most recent barter response produced an out-of-band shortfall
   * (|shortfall| > SANITY_GATE_PCT) that we don't trust as a real routing
   * signal. Used to surface "swap too small" via amountTooSmall instead of
   * silently swallowing the observation, which previously left auto-slippage at
   * baseline and the swap button enabled despite an un-coverable routing cost.
   */
  const [sanityGated, setSanityGated] = useState(false)
  // The inputKey the *stored* barter values were validated against. When the
  // inputKey changes (e.g. token switch, new amount) the values held in state
  // are immediately stale — but the cleanup `useEffect` runs after render, so
  // the first render after the change would otherwise expose stale data to
  // consumers (causing the miles bar / max miles to flash an order-of-
  // magnitude wrong number). Gating the returned values on this key === the
  // current inputKey makes the staleness invisible to consumers.
  const [storedForKey, setStoredForKey] = useState("")
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
      setSanityGated(false)
      setBarterAmountOut(undefined)
      setBarterPreGasOutputAmount(undefined)
      setBarterUnavailable(false)
      setSettled(true)
      lastSettledKeyRef.current = ""
      requestIdRef.current++
      return
    }

    // Defer while uniswap quote is in flight. With sellAmount changing
    // synchronously and amountOut only updating after the quote refetch,
    // running the comparison now would feed fresh barter for the new size
    // against stale uniswap output for the prior size — a 40-50% phantom
    // shortfall that the ratchet locks in. Stay marked unsettled so
    // downstream gates know we're not ready.
    if (isQuoteLoading) {
      setSettled(false)
      requestIdRef.current++
      return
    }

    const sellClean = sellAmount?.replace(/,/g, "").trim()
    if (!sellClean || parseFloat(sellClean) <= 0) {
      setShortfallPct(0)
      setSanityGated(false)
      setBarterAmountOut(undefined)
      setBarterPreGasOutputAmount(undefined)
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
    setSanityGated(false)
    setBarterAmountOut(undefined)
    setBarterPreGasOutputAmount(undefined)
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
        const barterPreGas = BigInt(route.outputAmountPreGas)
        const shortfallRaw =
          amountOut > 0n ? Number(((amountOut - barterOut) * 10000n) / amountOut) / 100 : 0

        // Sanity guard. Two failure modes share this branch:
        //   1. Stale-quote artifact mid-token-switch — `amountOut` is the
        //      previous pair's bigint (e.g. ETH wei) while `barterOut` is the
        //      new pair's (e.g. USDC raw). The shortfall reads astronomical.
        //   2. Real-but-uncoverable: gas eats so much of output that no
        //      reasonable slippage can absorb it. The swap genuinely can't go
        //      through, but we want the user to know — not silently push auto
        //      to 50% and pretend it'll succeed.
        //
        // Both surface via `sanityGated → amountTooSmall = true` so the existing
        // "swap too small" UI path picks them up. We do NOT update barter
        // amounts (case 1's data is garbage) but we DO settle so the swap
        // button reflects the new gated state immediately.
        if (Math.abs(shortfallRaw) > SANITY_GATE_PCT) {
          setBarterAmountOut(undefined)
          setBarterPreGasOutputAmount(undefined)
          setShortfallPct(0)
          setSanityGated(true)
          setBarterUnavailable(false)
          setSettled(true)
          setStoredForKey(inputKey)
          return
        }

        setBarterAmountOut(barterOut)
        setBarterPreGasOutputAmount(barterPreGas)
        setShortfallPct(Math.max(0, shortfallRaw))
        setSanityGated(false)
        setBarterUnavailable(false)
        setSettled(true)
        setStoredForKey(inputKey)
      } catch (err) {
        if (cancelled || currentRequest !== requestIdRef.current) return

        const failures = consecutiveFailures + 1
        const sustained = failures >= UNAVAILABLE_ERROR_THRESHOLD
        reportClientError(err, {
          source: "use-barter-validation.fetchBarterRoute",
          consecutiveFailures: failures,
          sustained,
          sourceToken: source,
          targetToken: target,
          sellAmtWei,
          isEthInput,
        })

        if (sustained) {
          // Sustained outage — block the swap button, clear any stale Barter data,
          // and mark settled so the UI stops spinning.
          setBarterAmountOut(undefined)
          setBarterPreGasOutputAmount(undefined)
          setShortfallPct(0)
          setBarterUnavailable(true)
          setSettled(true)
          setStoredForKey(inputKey)
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
  }, [
    fromToken,
    toToken,
    amountOut,
    sellAmount,
    quoteGeneration,
    enabled,
    inputKey,
    isQuoteLoading,
  ])

  // Derive amountTooSmall from cached shortfall + live slippage tolerance.
  // This lets the gate re-evaluate instantly when the user bumps their slippage
  // (no extra Barter API call, no "calculating" flicker) while still accurately
  // reflecting whether the current tolerance covers the measured shortfall.
  //
  // Also fires when the most recent observation hit the sanity gate — that's
  // the "uncoverable shortfall / stale data" branch above. Both shapes mean
  // the user's current swap can't be filled at the current tolerance.
  const amountTooSmall =
    settled && (sanityGated || (shortfallPct > 0 && shortfallPct > maxSlippagePct))

  // Synchronously gate every returned value on whether it was validated for
  // the *current* inputKey. On a token switch, inputKey changes immediately
  // but the cleanup `useEffect` hasn't yet cleared the cached state, so
  // without this gate consumers would briefly see the old pair's data
  // applied to the new pair (decimals mismatch → orders-of-magnitude-wrong
  // miles in the bar/max). With the gate, all values look "in flight"
  // until the new pair's validation settles.
  const isCurrent = storedForKey === inputKey
  return {
    amountTooSmall: isCurrent && amountTooSmall,
    shortfallPct: isCurrent ? shortfallPct : 0,
    isValidating: !isCurrent || !settled,
    barterAmountOut: isCurrent ? barterAmountOut : undefined,
    barterPreGasOutputAmount: isCurrent ? barterPreGasOutputAmount : undefined,
    barterUnavailable: isCurrent && barterUnavailable,
  }
}
