"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TransactionReceipt } from "viem"
import { fetchFastTxStatus } from "@/lib/fast-tx-status"
import { fetchTransactionReceiptFromDb } from "@/lib/transaction-receipt-utils"
import { fetchCommitmentStatus } from "@/lib/fast-rpc-status"
import { getTxConfirmationTimeoutMs } from "@/lib/tx-config"
import { RPCError } from "@/lib/transaction-errors"

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
        const e = new RPCError("RPC Error", receipt)
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

    const e = receiptError instanceof Error ? receiptError : new Error(String(receiptError))
    setError(e)
    onErrorRef.current?.(e)
  }, [hash, receiptError])

  // Effect: Two-phase polling with decoupled DB failure detection
  useEffect(() => {
    if (!hash || processingHashRef.current === hash) return

    processingHashRef.current = hash
    preConfirmedFiredRef.current = false
    console.log(`[TxConfirmation] Polling started | hash=${hash}`)
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
            const mcStatus = await fetchFastTxStatus(hash, abortController.signal)
            if (abortController.signal.aborted || hasConfirmedRef.current) return

            if (mcStatus === "failed") {
              hasConfirmedRef.current = true
              abortController.abort()
              const e = new Error("Transaction was dropped by the network.")
              setError(e)
              onErrorRef.current?.(e)
            } else if (mcStatus === "confirmed") {
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
            } else if (mcStatus === "preconfirmed") {
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

          if (pollCount <= 10 || pollCount % 10 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
            console.log(`[TxConfirmation] Poll #${pollCount} | +${elapsed}s | commit=${commitStatus} | rpc=${rpcResult?.receipt?.status ?? "null"} | hash=${hash.slice(0, 14)}...`)
          }

          if (abortController.signal.aborted || hasConfirmedRef.current) break

          // RPC receipt with reverted status → immediate error
          if (rpcResult && rpcResult.receipt.status === "reverted") {
            hasConfirmedRef.current = true
            abortController.abort()
            clearInterval(dbPollInterval)
            const e = new RPCError("RPC Error", rpcResult.receipt, rpcResult.rawResult)
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

          const mcStatus = await fetchFastTxStatus(hash, abortController.signal)

          if (abortController.signal.aborted || hasConfirmedRef.current) break

          if (mcStatus === "confirmed") {
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

          if (mcStatus === "failed") {
            hasConfirmedRef.current = true
            abortController.abort()
            clearInterval(dbPollInterval)
            const e = new Error("Transaction was dropped by the network.")
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
