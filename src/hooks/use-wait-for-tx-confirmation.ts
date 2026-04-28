"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TransactionReceipt } from "viem"
import { fetchFastTxStatus } from "@/lib/fast-tx-status"
import { fetchTransactionReceiptFromDb } from "@/lib/transaction-receipt-utils"
import { fetchCommitmentStatus } from "@/lib/fast-rpc-status"
import { getTxConfirmationTimeoutMs } from "@/lib/tx-config"
import { RPCError, buildRevertMessage } from "@/lib/transaction-errors"

/** Standard user-facing copy for swap failures. Detail belongs in logs, not the toast. */
const SWAP_FAILED_MESSAGE = "Swap was dropped by the network, please try again"

/**
 * Returns an Error with a friendly user-facing message that still carries the
 * underlying error's diagnostic fields (cause, viem `shortMessage`/`details`/
 * `metaMessages`/`walk`, original stack) so `reportClientError` forwards them
 * verbatim to Vercel — and so the toast UI never has to show raw RPC strings.
 */
function buildSwapFailedError(cause: unknown, fallbackDetails?: string | null): Error {
  const e = new Error(SWAP_FAILED_MESSAGE)
  if (cause != null) {
    ;(e as { cause?: unknown }).cause = cause
    if (typeof cause === "object") {
      const c = cause as {
        shortMessage?: unknown
        details?: unknown
        metaMessages?: unknown
        walk?: unknown
        stack?: unknown
      }
      const decorated = e as unknown as Record<string, unknown>
      if (typeof c.shortMessage === "string") decorated.shortMessage = c.shortMessage
      if (typeof c.details === "string") decorated.details = c.details
      if (Array.isArray(c.metaMessages)) decorated.metaMessages = c.metaMessages
      if (typeof c.walk === "function") decorated.walk = (c.walk as Function).bind(c)
      if (typeof c.stack === "string") decorated.stack = c.stack
    }
  }
  if (fallbackDetails && !(e as { details?: unknown }).details) {
    ;(e as { details?: unknown }).details = fallbackDetails
  }
  return e
}

/**
 * Adaptive polling: starts fast to catch sub-second preconfirmations,
 * then backs off. First 5 polls at 100ms (~500ms window), then 500ms.
 */
const FAST_POLL_INTERVAL_MS = 100
const NORMAL_POLL_INTERVAL_MS = 500
const FAST_POLL_COUNT = 5
/** DB failure detection runs independently on a slower cadence */
const DB_POLL_INTERVAL_MS = 2000

function getPollInterval(pollCount: number): number {
  return pollCount < FAST_POLL_COUNT ? FAST_POLL_INTERVAL_MS : NORMAL_POLL_INTERVAL_MS
}

export type WaitForTxConfirmationMode = "receipt" | "status"

export interface TxConfirmationResult {
  source: "db" | "wagmi"
  receipt?: TransactionReceipt
  status?: { success: boolean; hash: string }
}

export interface UseWaitForTxConfirmationParams {
  hash: string | undefined
  receipt: TransactionReceipt | undefined
  /** Error from wagmi's useWaitForTransactionReceipt (e.g. tx dropped, replaced, RPC failure). */
  receiptError?: Error | null
  mode: WaitForTxConfirmationMode
  onConfirmed: (result: TxConfirmationResult) => void
  /** Called when RPC receipt or commitments report preconfirmed. */
  onPreConfirmed?: (result: TxConfirmationResult) => void
  onError?: (error: Error) => void
}

export interface UseWaitForTxConfirmationReturn {
  isConfirming: boolean
  error: Error | null
  reset: () => void
}

/**
 * Two-phase polling with decoupled failure detection:
 *
 * Phase 1 (pending → preconfirmed):
 *   Fast loop: poll commitment status + RPC receipt (both hit FastRPC directly).
 *   Background: poll mctransactions DB every 2s for failure detection only.
 *   First source to show preconfirmed fires onPreConfirmed.
 *
 * Phase 2 (preconfirmed → final):
 *   Poll mctransactions + RPC receipt for confirmed/failed.
 *
 * Wagmi receipt (on-chain) stays active throughout as a parallel fallback.
 *
 * Key optimization: the slow DB call (mctransactions via StarRocks) never
 * blocks the fast RPC calls. Preconfirmation detection runs at RPC speed.
 */
export function useWaitForTxConfirmation({
  hash,
  receipt,
  receiptError,
  mode,
  onConfirmed,
  onPreConfirmed,
  onError,
}: UseWaitForTxConfirmationParams): UseWaitForTxConfirmationReturn {
  const [error, setError] = useState<Error | null>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const hasConfirmedRef = useRef(false)
  const processingHashRef = useRef<string | null>(null)
  const preConfirmedFiredRef = useRef(false)

  // Refs to ensure callbacks stay fresh without re-triggering effects
  const onConfirmedRef = useRef(onConfirmed)
  const onPreConfirmedRef = useRef(onPreConfirmed)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onConfirmedRef.current = onConfirmed
    onPreConfirmedRef.current = onPreConfirmed
    onErrorRef.current = onError
  }, [onConfirmed, onPreConfirmed, onError])

  const reset = useCallback(() => {
    setIsConfirmed(false)
    setError(null)
    hasConfirmedRef.current = false
    processingHashRef.current = null
    preConfirmedFiredRef.current = false
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // Effect: Watch for Wagmi (on-chain) receipt — parallel fallback throughout
  useEffect(() => {
    if (!hash || !receipt || hasConfirmedRef.current) return

    if (abortRef.current) abortRef.current.abort()

    try {
      if (receipt.status === "reverted") {
        hasConfirmedRef.current = true
        const e = new RPCError(buildRevertMessage(receipt), receipt)
        setError(e)
        onErrorRef.current?.(e)
        return
      }
      hasConfirmedRef.current = true
      setIsConfirmed(true)
      if (mode === "receipt") {
        onConfirmedRef.current({ source: "wagmi", receipt })
      } else {
        onConfirmedRef.current({
          source: "wagmi",
          status: { success: receipt.status === "success", hash },
        })
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      onErrorRef.current?.(e)
    }
  }, [hash, receipt, mode])

  // Effect: Watch for wagmi receipt error (tx dropped, replaced, RPC failure)
  useEffect(() => {
    if (!receiptError) return

    hasConfirmedRef.current = true
    if (abortRef.current) abortRef.current.abort()

    // Wrap the wagmi/viem error in a friendly user-facing message while
    // preserving viem fields (shortMessage/details/metaMessages/walk) and the
    // original stack so Vercel logs retain the full diagnostic.
    const e = buildSwapFailedError(receiptError)
    setError(e)
    onErrorRef.current?.(e)
  }, [hash, receiptError])

  // Effect: Two-phase polling with decoupled DB failure detection
  useEffect(() => {
    if (!hash || processingHashRef.current === hash) return

    processingHashRef.current = hash
    preConfirmedFiredRef.current = false
    const abortController = new AbortController()
    abortRef.current = abortController
    setIsConfirmed(false)
    setError(null)

    /** Fire onPreConfirmed once, from whichever source wins the race. */
    const firePreConfirmed = () => {
      if (preConfirmedFiredRef.current) return
      preConfirmedFiredRef.current = true
      const result: TxConfirmationResult =
        mode === "receipt" ? { source: "db" } : { source: "db", status: { success: true, hash } }
      try {
        onPreConfirmedRef.current?.(result)
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        onErrorRef.current?.(e)
      }
    }

    const poll = async () => {
      try {
        const timeoutMs = await getTxConfirmationTimeoutMs()
        const startTime = Date.now()
        let pollCount = 0

        // Background DB poll for failure detection (runs independently, never blocks fast path)
        const dbPollInterval = setInterval(async () => {
          if (abortController.signal.aborted || hasConfirmedRef.current) return
          try {
            const mc = await fetchFastTxStatus(hash, abortController.signal)
            if (abortController.signal.aborted || hasConfirmedRef.current) return

            if (mc.status === "failed") {
              hasConfirmedRef.current = true
              abortController.abort()
              const e = buildSwapFailedError(null, mc.details)
              setError(e)
              onErrorRef.current?.(e)
            } else if (mc.status === "confirmed") {
              // DB caught up — fire confirmed if we haven't already
              if (!hasConfirmedRef.current) {
                hasConfirmedRef.current = true
                abortController.abort()
                setIsConfirmed(true)
                const result: TxConfirmationResult =
                  mode === "receipt"
                    ? { source: "db" }
                    : { source: "db", status: { success: true, hash } }
                firePreConfirmed()
                onConfirmedRef.current(result)
              }
            } else if (mc.status === "preconfirmed") {
              firePreConfirmed()
            }
          } catch {
            // Ignore DB poll errors — fast path handles preconfirmation
          }
        }, DB_POLL_INTERVAL_MS)

        // ── Phase 1: Fast RPC polling for preconfirmation ──
        while (!abortController.signal.aborted && !hasConfirmedRef.current) {
          if (Date.now() - startTime > timeoutMs) {
            clearInterval(dbPollInterval)
            const e = new Error(
              "Transaction confirmation timed out — your swap may have still succeeded. Check your wallet."
            )
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          // Poll only fast sources — both hit FastRPC directly
          const [commitStatus, rpcResult] = await Promise.all([
            fetchCommitmentStatus(hash, abortController.signal),
            fetchTransactionReceiptFromDb(hash, abortController.signal),
          ])

          if (abortController.signal.aborted || hasConfirmedRef.current) break

          // RPC receipt with reverted status → immediate error
          if (rpcResult && rpcResult.receipt.status === "reverted") {
            hasConfirmedRef.current = true
            abortController.abort()
            clearInterval(dbPollInterval)
            const e = new RPCError(
              buildRevertMessage(rpcResult.receipt, rpcResult.rawResult),
              rpcResult.receipt,
              rpcResult.rawResult
            )
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          // Either fast source signals preconfirmed → fire and move to phase 2
          if (
            commitStatus === "preconfirmed" ||
            (rpcResult && rpcResult.receipt.status === "success")
          ) {
            firePreConfirmed()
            break // → Phase 2
          }

          await new Promise((r) => setTimeout(r, getPollInterval(pollCount++)))
        }

        // ── Phase 2: Wait for confirmed/failed ──
        // Wagmi handles confirmed detection via real L1 receipt (passed as prop).
        // We only poll DB here for failure detection. Wagmi's onConfirmed effect
        // fires when a real on-chain receipt arrives — no FastRPC simulated receipt issue.
        while (!abortController.signal.aborted && !hasConfirmedRef.current) {
          if (Date.now() - startTime > timeoutMs) {
            clearInterval(dbPollInterval)
            const e = new Error(
              "Transaction confirmation timed out — your swap may have still succeeded. Check your wallet."
            )
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          const mc = await fetchFastTxStatus(hash, abortController.signal)

          if (abortController.signal.aborted || hasConfirmedRef.current) break

          if (mc.status === "confirmed") {
            hasConfirmedRef.current = true
            abortController.abort()
            clearInterval(dbPollInterval)
            setIsConfirmed(true)
            const result: TxConfirmationResult =
              mode === "receipt"
                ? { source: "db" }
                : { source: "db", status: { success: true, hash } }
            onConfirmedRef.current(result)
            return
          }

          if (mc.status === "failed") {
            hasConfirmedRef.current = true
            abortController.abort()
            clearInterval(dbPollInterval)
            const e = buildSwapFailedError(null, mc.details)
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          await new Promise((r) => setTimeout(r, NORMAL_POLL_INTERVAL_MS))
        }

        clearInterval(dbPollInterval)
      } catch (err) {
        if ((err as Error).name !== "AbortError" && !hasConfirmedRef.current) {
          const e = err instanceof Error ? err : new Error(String(err))
          setError(e)
          onErrorRef.current?.(e)
        }
      }
    }

    poll()

    return () => {
      abortController.abort()
      if (abortRef.current === abortController) abortRef.current = null
      processingHashRef.current = null
    }
  }, [hash, mode])

  const isConfirming = !!hash && !isConfirmed && !error

  return { isConfirming, error, reset }
}
