"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TransactionReceipt } from "viem"
import {
  pollDatabaseForReceipt,
  pollDatabaseForStatus,
  checkTransactionReceiptExists,
} from "@/lib/transaction-receipt-utils"

const RECEIPT_CHECK_INTERVAL_MS = 100

export type WaitForTxConfirmationMode = "receipt" | "status"

export interface TxConfirmationResult {
  source: "db" | "wagmi"
  receipt?: TransactionReceipt
  status?: { success: boolean; hash: string }
}

export interface UseWaitForTxConfirmationParams {
  hash: string | undefined
  receipt: TransactionReceipt | undefined
  mode: WaitForTxConfirmationMode
  onConfirmed: (result: TxConfirmationResult) => void
  onError?: (error: Error) => void
}

export interface UseWaitForTxConfirmationReturn {
  isConfirming: boolean
  error: Error | null
  reset: () => void
}

/**
 * Shared hook: races DB poll (receipt or status) with wagmi receipt.
 * Calls onConfirmed once when either wins; try/catch around all async paths.
 */
export function useWaitForTxConfirmation({
  hash,
  receipt,
  mode,
  onConfirmed,
  onError,
}: UseWaitForTxConfirmationParams): UseWaitForTxConfirmationReturn {
  const [error, setError] = useState<Error | null>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const confirmedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const onConfirmedRef = useRef(onConfirmed)
  const onErrorRef = useRef(onError)
  onConfirmedRef.current = onConfirmed
  onErrorRef.current = onError

  const reset = useCallback(() => {
    confirmedRef.current = false
    setIsConfirmed(false)
    setError(null)
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!hash) {
      return
    }

    confirmedRef.current = false
    setIsConfirmed(false)
    const abortController = new AbortController()
    abortRef.current = abortController
    let isProcessing = false

    const tryConfirm = (result: TxConfirmationResult) => {
      if (isProcessing || abortController.signal.aborted) return
      isProcessing = true
      confirmedRef.current = true
      setIsConfirmed(true)
      try {
        onConfirmedRef.current(result)
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        onErrorRef.current?.(e)
      }
      abortController.abort()
    }

    // Receipt mode: poll DB for full receipt
    if (mode === "receipt") {
      pollDatabaseForReceipt(hash, abortController.signal)
        .then((dbReceipt) => {
          if (abortController.signal.aborted || !dbReceipt) return
          tryConfirm({ source: "db", receipt: dbReceipt })
        })
        .catch((err) => {
          if (abortController.signal.aborted || (err as Error).name === "AbortError") return
          const e = err instanceof Error ? err : new Error(String(err))
          setError(e)
          onErrorRef.current?.(e)
        })
    } else {
      // Status mode: poll DB for status
      pollDatabaseForStatus(hash, abortController.signal)
        .then((dbResult) => {
          if (abortController.signal.aborted || !dbResult) return
          tryConfirm({ source: "db", status: dbResult })
        })
        .catch((err) => {
          if (abortController.signal.aborted || (err as Error).name === "AbortError") return
          const e = err instanceof Error ? err : new Error(String(err))
          setError(e)
          onErrorRef.current?.(e)
        })
    }

    const checkWagmiReceipt = () => {
      if (!receipt || abortController.signal.aborted) return

      if (mode === "receipt") {
        tryConfirm({ source: "wagmi", receipt })
        return
      }

      // Status mode: verify receipt exists in DB then confirm
      checkTransactionReceiptExists(hash, abortController.signal)
        .then((exists) => {
          if (abortController.signal.aborted || !exists) return
          tryConfirm({ source: "wagmi", status: { success: true, hash } })
        })
        .catch((err) => {
          if (abortController.signal.aborted || (err as Error).name === "AbortError") return
          const e = err instanceof Error ? err : new Error(String(err))
          setError(e)
          onErrorRef.current?.(e)
        })
    }

    checkWagmiReceipt()
    const intervalId = setInterval(checkWagmiReceipt, RECEIPT_CHECK_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
      abortController.abort()
      abortRef.current = null
    }
  }, [hash, receipt, mode])

  const isConfirming = !!hash && !isConfirmed && !error

  return {
    isConfirming,
    error,
    reset,
  }
}
