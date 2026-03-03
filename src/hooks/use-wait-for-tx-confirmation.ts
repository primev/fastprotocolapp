"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TransactionReceipt } from "viem"
import { fetchTransactionReceiptFromDb } from "@/lib/transaction-receipt-utils"
import { getTxConfirmationTimeoutMs } from "@/lib/tx-config"
import { RPCError } from "@/lib/transaction-errors"

const RECEIPT_CHECK_INTERVAL_MS = 500

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
  /** Called when DB finds receipt first (before on-chain). Wagmi continues waiting for on-chain confirmation. */
  onPreConfirmed?: (result: TxConfirmationResult) => void
  onError?: (error: Error) => void
}

export interface UseWaitForTxConfirmationReturn {
  isConfirming: boolean
  error: Error | null
  reset: () => void
}

/**
 * Races database polling against Wagmi's on-chain receipt.
 * The first to resolve triggers onConfirmed and halts the other process.
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

  // Effect: Watch for Wagmi (on-chain) receipt to arrive
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
    if ( !receiptError ) return

    hasConfirmedRef.current = true
    if (abortRef.current) abortRef.current.abort()

    const e = receiptError instanceof Error ? receiptError : new Error(String(receiptError))
    setError(e)
    onErrorRef.current?.(e)
  }, [hash, receiptError])

  // Effect: Database polling logic (one fetch per iteration to detect status flip 0x1 -> 0x0)
  // Start whenever we have a hash and aren't already polling this hash (don't gate on hasConfirmedRef
  // so that we still poll when Wagmi receipt isn't ready yet and DB can be first)
  useEffect(() => {
    if (!hash || processingHashRef.current === hash) return

    processingHashRef.current = hash
    preConfirmedFiredRef.current = false
    const abortController = new AbortController()
    abortRef.current = abortController
    setIsConfirmed(false)
    setError(null)

    const dbPoll = async () => {
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

          const dbResult = await fetchTransactionReceiptFromDb(hash, abortController.signal)

          if (dbResult) {
            const { receipt: dbReceipt, rawResult } = dbResult
            if (dbReceipt.status === "reverted") {
              hasConfirmedRef.current = true
              abortController.abort()
              const e = new RPCError("RPC Error", dbReceipt, rawResult)
              setError(e)
              onErrorRef.current?.(e)
              return
            }
            // Success (0x1): fire onPreConfirmed once, then keep polling to detect flip to 0x0
            if (!preConfirmedFiredRef.current) {
              preConfirmedFiredRef.current = true
              const result: TxConfirmationResult =
                mode === "receipt"
                  ? { source: "db", receipt: dbReceipt }
                  : { source: "db", status: { success: true, hash } }
              try {
                onPreConfirmedRef.current?.(result)
              } catch (err) {
                const e = err instanceof Error ? err : new Error(String(err))
                setError(e)
                onErrorRef.current?.(e)
              }
            }
          }

          await new Promise((r) => setTimeout(r, RECEIPT_CHECK_INTERVAL_MS))
        }
      } catch (err) {
        // Ignore deliberate aborts; surface genuine polling errors
        if ((err as Error).name !== "AbortError" && !hasConfirmedRef.current) {
          const e = err instanceof Error ? err : new Error(String(err))
          setError(e)
          onErrorRef.current?.(e)
        }
      }
    }

    dbPoll()

    return () => {
      abortController.abort()
      if (abortRef.current === abortController) abortRef.current = null
      processingHashRef.current = null
    }
  }, [hash, mode])

  const isConfirming = !!hash && !isConfirmed && !error

  return { isConfirming, error, reset }
}
