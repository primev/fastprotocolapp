"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TransactionReceipt } from "viem"
import { fetchFastTxStatus } from "@/lib/fast-tx-status"
import { fetchTransactionReceiptFromDb } from "@/lib/transaction-receipt-utils"
import { getTxConfirmationTimeoutMs } from "@/lib/tx-config"
import { RPCError } from "@/lib/transaction-errors"

const STATUS_CHECK_INTERVAL_MS = 500

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
  /** Called when mctransactions reports pre-confirmed or DB has success receipt. */
  onPreConfirmed?: (result: TxConfirmationResult) => void
  onError?: (error: Error) => void
}

export interface UseWaitForTxConfirmationReturn {
  isConfirming: boolean
  error: Error | null
  reset: () => void
}

/**
 * Polls mctransactions for swap lifecycle status (pre-confirmed / failed),
 * races against Wagmi's on-chain receipt for final confirmation.
 *
 * - mctransactions "pre-confirmed" → fire onPreConfirmed, keep polling
 * - mctransactions "confirmed" → fire onPreConfirmed + onConfirmed (final, no wagmi wait)
 * - mctransactions "failed" → fire onError immediately (dropped tx)
 * - Wagmi receipt success → fire onConfirmed (if mctransactions hasn't already)
 * - Wagmi receipt reverted → fire onError
 * - Timeout → fire onError
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

  // Effect: Watch for Wagmi (on-chain) receipt — this is the final authority for success
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

  // Effect: Poll mctransactions for pre-confirmed/failed status
  useEffect(() => {
    if (!hash || processingHashRef.current === hash) return

    processingHashRef.current = hash
    preConfirmedFiredRef.current = false
    const abortController = new AbortController()
    abortRef.current = abortController
    setIsConfirmed(false)
    setError(null)

    const poll = async () => {
      try {
        const timeoutMs = await getTxConfirmationTimeoutMs()
        const startTime = Date.now()

        while (!abortController.signal.aborted && !hasConfirmedRef.current) {
          if (Date.now() - startTime > timeoutMs) {
            const e = new Error(
              "Transaction confirmation timed out — your swap may have still succeeded. Check your wallet."
            )
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          // Poll mctransactions status
          const mcStatus = await fetchFastTxStatus(hash, abortController.signal)

          if (abortController.signal.aborted || hasConfirmedRef.current) return

          if (mcStatus === "failed") {
            // Dropped/failed tx — try to get receipt for error details
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
              // Receipt fetch is best-effort for error details
            }

            const e = dbReceipt
              ? new RPCError("Transaction failed", dbReceipt, rawResult)
              : new Error("Transaction was dropped by the network.")
            setError(e)
            onErrorRef.current?.(e)
            return
          }

          if (mcStatus === "confirmed") {
            // mctransactions says confirmed — treat as final success
            hasConfirmedRef.current = true
            abortController.abort()
            setIsConfirmed(true)
            const result: TxConfirmationResult =
              mode === "receipt"
                ? { source: "db" }
                : { source: "db", status: { success: true, hash } }
            // Fire onPreConfirmed first if it hasn't fired yet
            if (!preConfirmedFiredRef.current) {
              preConfirmedFiredRef.current = true
              try {
                onPreConfirmedRef.current?.(result)
              } catch {
                // Best-effort; onConfirmed is the important one
              }
            }
            onConfirmedRef.current(result)
            return
          }

          if (mcStatus === "pre-confirmed" && !preConfirmedFiredRef.current) {
            preConfirmedFiredRef.current = true
            const result: TxConfirmationResult =
              mode === "receipt"
                ? { source: "db" }
                : { source: "db", status: { success: true, hash } }
            try {
              onPreConfirmedRef.current?.(result)
            } catch (err) {
              const e = err instanceof Error ? err : new Error(String(err))
              setError(e)
              onErrorRef.current?.(e)
            }
          }

          await new Promise((r) => setTimeout(r, STATUS_CHECK_INTERVAL_MS))
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
