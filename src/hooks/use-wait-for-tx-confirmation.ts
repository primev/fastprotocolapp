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
 * Hook that races DB polling against Wagmi receipt.
 * The first to resolve triggers onConfirmed; the other stops.
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
  const onConfirmedRef = useRef(onConfirmed)
  const onErrorRef = useRef(onError)
  onConfirmedRef.current = onConfirmed
  onErrorRef.current = onError

  const reset = useCallback(() => {
    console.log("[useWaitForTxConfirmation] Resetting state")
    setIsConfirmed(false)
    setError(null)
    hasConfirmedRef.current = false
    processingHashRef.current = null
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // Watch for wagmi receipt to arrive
  useEffect(() => {
    if (!hash || !receipt || hasConfirmedRef.current) return

    console.log("[useWaitForTxConfirmation] Wagmi receipt arrived!")
    console.log("receipt", JSON.stringify(receipt, null, 2))
    hasConfirmedRef.current = true
    setIsConfirmed(true)

    if (abortRef.current) {
      abortRef.current.abort()
    }

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

  // DB polling - only start once per hash
  useEffect(() => {
    // Don't start if no hash, already confirmed, or already processing this hash
    if (!hash) return
    if (hasConfirmedRef.current) return
    if (processingHashRef.current === hash) {
      console.log("[useWaitForTxConfirmation] Already polling for this hash, skipping duplicate")
      return
    }

    console.log(`[useWaitForTxConfirmation] Starting DB polling for ${hash}`)
    processingHashRef.current = hash

    const abortController = new AbortController()
    abortRef.current = abortController
    setIsConfirmed(false)
    setError(null)

    const dbPoll = async () => {
      try {
        while (!abortController.signal.aborted && !hasConfirmedRef.current) {
          let result: {
            source: "db"
            receipt?: TransactionReceipt
            status?: { success: boolean; hash: string }
          } | null = null

          if (mode === "receipt") {
            const dbReceipt = await pollDatabaseForReceipt(hash, abortController.signal)
            if (dbReceipt) result = { source: "db", receipt: dbReceipt }
          } else {
            const dbStatus = await pollDatabaseForStatus(hash, abortController.signal)
            if (dbStatus) result = { source: "db", status: dbStatus }
          }

          if (result && !hasConfirmedRef.current) {
            console.log("[useWaitForTxConfirmation] DB polling found confirmation!")
            console.log("result", JSON.stringify(result, null, 2))
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
        if ((err as Error).name !== "AbortError" && !hasConfirmedRef.current) {
          const e = err instanceof Error ? err : new Error(String(err))
          console.error("[useWaitForTxConfirmation] DB polling error:", e)
          setError(e)
          onErrorRef.current?.(e)
        }
      }
    }

    dbPoll()

    return () => {
      console.log(`[useWaitForTxConfirmation] Cleanup - aborting polling for ${hash}`)
      abortController.abort()
      if (abortRef.current === abortController) {
        abortRef.current = null
      }
    }
  }, [hash, mode]) // Only re-run if hash or mode changes

  const isConfirming = !!hash && !isConfirmed && !error
  return { isConfirming, error, reset }
}
