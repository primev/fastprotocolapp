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
  /** Called when RPC receipt or mctransactions reports preconfirmed. */
  onPreConfirmed?: (result: TxConfirmationResult) => void
  onError?: (error: Error) => void
}

export interface UseWaitForTxConfirmationReturn {
  isConfirming: boolean
  error: Error | null
  reset: () => void
}

/**
 * Two-phase polling with Wagmi as parallel fallback:
 *
 * Phase 1 (pending → preconfirmed):
 *   Poll BOTH eth_getTransactionReceipt (FastRPC) and mctransactions in parallel.
 *   First source to show success/preconfirmed fires onPreConfirmed.
 *   mctransactions "failed" in this phase fires onError immediately.
 *
 * Phase 2 (preconfirmed → final):
 *   Stop RPC receipt polling. Poll only mctransactions for confirmed/failed.
 *   mctransactions "confirmed" → fire onConfirmed (final success).
 *   mctransactions "failed" → fire onError.
 *
 * Wagmi receipt (on-chain) stays active throughout as a parallel fallback.
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

  // Effect: Two-phase polling
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

        // ── Phase 1: Poll both RPC receipt and mctransactions ──
        while (!abortController.signal.aborted && !hasConfirmedRef.current) {
          if (Date.now() - startTime > timeoutMs) {
            const e = new Error(
              "Transaction confirmation timed out — your swap may have still succeeded. Check your wallet."
            )
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          // Poll three sources in parallel:
          // 1. FastRPC commitment status (fastest — node knows instantly)
          // 2. RPC eth_getTransactionReceipt
          // 3. mctransactions DB status (slowest — lags ~15s)
          const [commitStatus, rpcResult, mcStatus] = await Promise.all([
            fetchCommitmentStatus(hash, abortController.signal),
            fetchTransactionReceiptFromDb(hash, abortController.signal),
            fetchFastTxStatus(hash, abortController.signal),
          ])

          if (abortController.signal.aborted || hasConfirmedRef.current) return

          // mctransactions "failed" → immediate error (dropped tx)
          if (mcStatus === "failed") {
            hasConfirmedRef.current = true
            abortController.abort()
            const e = rpcResult
              ? new RPCError("Transaction failed", rpcResult.receipt, rpcResult.rawResult)
              : new Error("Transaction was dropped by the network.")
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          // RPC receipt with reverted status → immediate error
          if (rpcResult && rpcResult.receipt.status === "reverted") {
            hasConfirmedRef.current = true
            abortController.abort()
            const e = new RPCError("RPC Error", rpcResult.receipt, rpcResult.rawResult)
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          // Any source signals preconfirmed → fire and move to phase 2
          if (
            commitStatus === "preconfirmed" ||
            mcStatus === "preconfirmed" ||
            mcStatus === "confirmed" ||
            (rpcResult && rpcResult.receipt.status === "success")
          ) {
            firePreConfirmed()
            // If mctransactions already says confirmed, finish now
            if (mcStatus === "confirmed") {
              hasConfirmedRef.current = true
              abortController.abort()
              setIsConfirmed(true)
              const result: TxConfirmationResult =
                mode === "receipt"
                  ? { source: "db" }
                  : { source: "db", status: { success: true, hash } }
              onConfirmedRef.current(result)
              return
            }
            break // → Phase 2
          }

          await new Promise((r) => setTimeout(r, getPollInterval(pollCount++)))
        }

        // ── Phase 2: Poll only mctransactions for confirmed/failed ──
        while (!abortController.signal.aborted && !hasConfirmedRef.current) {
          if (Date.now() - startTime > timeoutMs) {
            const e = new Error(
              "Transaction confirmation timed out — your swap may have still succeeded. Check your wallet."
            )
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          const mcStatus = await fetchFastTxStatus(hash, abortController.signal)

          if (abortController.signal.aborted || hasConfirmedRef.current) return

          if (mcStatus === "confirmed") {
            hasConfirmedRef.current = true
            abortController.abort()
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

            let dbReceipt: TransactionReceipt | undefined
            let rawResult: unknown
            try {
              const receiptResult = await fetchTransactionReceiptFromDb(hash)
              if (receiptResult) {
                dbReceipt = receiptResult.receipt
                rawResult = receiptResult.rawResult
              }
            } catch {
              // Best-effort for error details
            }

            const e = dbReceipt
              ? new RPCError("Transaction failed", dbReceipt, rawResult)
              : new Error("Transaction was dropped by the network.")
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          await new Promise((r) => setTimeout(r, NORMAL_POLL_INTERVAL_MS))
        }
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
