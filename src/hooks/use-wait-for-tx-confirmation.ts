"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TransactionReceipt } from "viem"
import { pollDatabaseForReceipt, pollDatabaseForStatus } from "@/lib/transaction-receipt-utils"

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
 * Races database polling against Wagmi's on-chain receipt.
 * The first to resolve triggers onConfirmed and halts the other process.
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

  const abortRef = useRef<AbortController | null>(null)
  const hasConfirmedRef = useRef(false)
  const processingHashRef = useRef<string | null>(null)

  // Refs to ensure callbacks stay fresh without re-triggering effects
  const onConfirmedRef = useRef(onConfirmed)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onConfirmedRef.current = onConfirmed
    onErrorRef.current = onError
  }, [onConfirmed, onError])

  const reset = useCallback(() => {
    setIsConfirmed(false)
    setError(null)
    hasConfirmedRef.current = false
    processingHashRef.current = null
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // Effect: Watch for Wagmi (on-chain) receipt to arrive
  useEffect(() => {
    if (!hash || !receipt || hasConfirmedRef.current) return

    hasConfirmedRef.current = true
    setIsConfirmed(true)

    if (abortRef.current) abortRef.current.abort()

    try {
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

  // Effect: Database polling logic
  useEffect(() => {
    if (!hash || hasConfirmedRef.current || processingHashRef.current === hash) return

    processingHashRef.current = hash
    const abortController = new AbortController()
    abortRef.current = abortController
    setIsConfirmed(false)
    setError(null)

    const dbPoll = async () => {
      try {
        while (!abortController.signal.aborted && !hasConfirmedRef.current) {
          let result: TxConfirmationResult | null = null

          if (mode === "receipt") {
            const dbReceipt = await pollDatabaseForReceipt(hash, abortController.signal)
            if (dbReceipt) result = { source: "db", receipt: dbReceipt }
          } else {
            const dbStatus = await pollDatabaseForStatus(hash, abortController.signal)
            if (dbStatus) result = { source: "db", status: dbStatus }
          }

          // If a result is found and we haven't already confirmed via Wagmi
          if (result && !hasConfirmedRef.current) {
            hasConfirmedRef.current = true
            setIsConfirmed(true)
            abortController.abort()

            try {
              onConfirmedRef.current(result)
            } catch (err) {
              const e = err instanceof Error ? err : new Error(String(err))
              setError(e)
              onErrorRef.current?.(e)
            }
            return
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
    }
  }, [hash, mode])

  const isConfirming = !!hash && !isConfirmed && !error

  return { isConfirming, error, reset }
}
