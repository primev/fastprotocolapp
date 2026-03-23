"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import { useWaitForTransactionReceipt } from "wagmi"
import type { TransactionReceipt } from "viem"
import { X, RefreshCw } from "lucide-react"
import { useSwapToastStore } from "@/stores/swapToastStore"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import {
  getTransactionShortMessage,
  parseBarterSlippageError,
  RPCError,
} from "@/lib/transaction-errors"
import { FAST_PROTOCOL_NETWORK } from "@/lib/network-config"
import { TokenPairIcon } from "./TokenPairIcon"
import { cn } from "@/lib/utils"

/**
 * SwapToast handles the multi-stage lifecycle of a transaction:
 * pending → pre-confirmed → confirmed (or failed at any point).
 */
export function SwapToast({ hash }: { hash: string }) {
  const toast = useSwapToastStore((s) => s.toasts.find((t) => t.hash === hash))
  const setStatus = useSwapToastStore((s) => s.setStatus)
  const setFailed = useSwapToastStore((s) => s.setFailed)
  const showErrorForToast = useSwapToastStore((s) => s.showErrorForToast)
  const requestRetryWithSlippage = useSwapToastStore((s) => s.requestRetryWithSlippage)
  const collapse = useSwapToastStore((s) => s.collapse)
  const expand = useSwapToastStore((s) => s.expand)
  const removeToast = useSwapToastStore((s) => s.removeToast)

  const toastRef = useRef<HTMLDivElement>(null)

  // Placeholder hash (Permit path) until relayer returns real hash; don't poll until then
  const effectiveHash = hash.startsWith("pending-") ? undefined : hash

  const { data: receipt, error: receiptError } = useWaitForTransactionReceipt({
    hash: effectiveHash as `0x${string}` | undefined,
  })

  useWaitForTxConfirmation({
    hash: effectiveHash ?? undefined,
    receipt: (receipt as TransactionReceipt | undefined) ?? undefined,
    receiptError,
    mode: "status",
    onConfirmed: () => {
      if (effectiveHash) setStatus(hash, "confirmed")
      const t = useSwapToastStore.getState().toasts.find((x) => x.hash === hash)
      t?.onConfirm?.()
    },
    onPreConfirmed: () => {
      const currentStatus = useSwapToastStore.getState().toasts.find((t) => t.hash === hash)?.status
      if (effectiveHash && currentStatus !== "confirmed") {
        setStatus(hash, "pre-confirmed")
        const t = useSwapToastStore.getState().toasts.find((x) => x.hash === hash)
        t?.onPreConfirm?.()
      }
    },
    onError: (err) => {
      const txReceipt = err instanceof RPCError ? err.receipt : undefined
      const rawDbRecord = err instanceof RPCError ? err.rawDbRecord : undefined
      const message =
        typeof err?.message === "string" ? err.message : getTransactionShortMessage(err)
      setFailed(hash, txReceipt, message, rawDbRecord)
    },
  })

  // Click Outside Logic
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!toastRef.current?.contains(e.target as Node) && toast) {
        if (toast.status === "confirmed" || toast.status === "failed") {
          removeToast(hash)
        } else {
          collapse(hash)
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [hash, toast, collapse, removeToast])

  if (!toast) return null

  const isPending = toast.status === "pending"
  const isConfirmed = toast.status === "confirmed"
  const isPreConfirmed = toast.status === "pre-confirmed"
  const isFailed = toast.status === "failed"
  const explorerUrl = effectiveHash
    ? `${FAST_PROTOCOL_NETWORK.blockExplorerUrls[0]}tx/${effectiveHash}`
    : null

  // Failed State
  if (isFailed) {
    const barterSlippage = toast.errorMessage ? parseBarterSlippageError(toast.errorMessage) : null

    // Barter slippage: specialized inline retry toast
    if (barterSlippage) {
      return (
        <div
          ref={toastRef}
          className="relative w-[360px] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl border border-amber-500/30 animate-in fade-in slide-in-from-right-5 duration-300"
        >
          <div className="relative p-4 flex items-center gap-4">
            <div className="relative h-11 w-11 shrink-0 flex items-center justify-center">
              <div className="h-11 w-11 rounded-full bg-amber-500/10 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-amber-400" />
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-sm font-medium text-amber-400">Slippage too low</span>
              <div className="mt-0.5 text-xs text-neutral-500">
                Minimum required: {barterSlippage.recommendedSlippage}%
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  requestRetryWithSlippage(hash, barterSlippage.recommendedSlippage)
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Retry {barterSlippage.recommendedSlippage}%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeToast(hash)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Generic failure: "Swap Failed" — click toast for details, X to dismiss
    return (
      <div
        ref={toastRef}
        role="button"
        tabIndex={0}
        onClick={() => showErrorForToast(hash)}
        className="relative w-[360px] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl border border-red-500/30 animate-in fade-in slide-in-from-right-5 duration-300 cursor-pointer"
      >
        <div className="relative h-[84px] p-4 flex items-center gap-4">
          <div className="relative h-11 w-11 shrink-0 flex items-center justify-center">
            <div className="h-11 w-11 rounded-full bg-red-500/10 flex items-center justify-center">
              <X className="h-5 w-5 text-red-400" />
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-sm font-medium text-red-400">Swap Failed</span>
            <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
              {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} → {toast.amountOut ?? "—"}{" "}
              {toast.tokenOut?.symbol}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeToast(hash)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    )
  }

  // Collapsed State: Minimalist bubble
  if ((isPending || toast.status === "pre-confirmed") && toast.collapsed) {
    return (
      <button
        type="button"
        onClick={() => expand(hash)}
        className="flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 shadow"
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <span className="text-sm text-white">Pending</span>
      </button>
    )
  }

  return (
    <div
      ref={toastRef}
      role="button"
      tabIndex={0}
      onClick={() => explorerUrl && window.open(explorerUrl, "_blank")}
      className={cn(
        "relative w-[360px] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl transition-all duration-300 border border-white/10 hover:border-white/20",
        explorerUrl ? "cursor-pointer" : "cursor-default",
        isConfirmed && "border-white/20"
      )}
    >
      <div className="relative h-[84px] p-4 flex items-center gap-4">
        {/* LEFT ICON: Token pair for pending, Fast icon for pre-confirmed/confirmed */}
        <div className="relative h-11 w-11 shrink-0 overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)",
              isPreConfirmed || isConfirmed
                ? "-translate-x-16 opacity-0 scale-75"
                : "translate-x-0 opacity-100 scale-100"
            )}
          >
            <TokenPairIcon leftToken={toast.tokenIn} rightToken={toast.tokenOut} />
          </div>

          <div
            className={cn(
              "absolute inset-0 transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)",
              isPreConfirmed || isConfirmed
                ? "translate-x-0 opacity-100 scale-100"
                : "translate-x-16 opacity-0 scale-75"
            )}
          >
            <Image
              src="/assets/fast-icon.png"
              alt="Fast Protocol"
              width={44}
              height={44}
              className="h-11 w-11 object-cover rounded-full"
            />
          </div>
        </div>

        {/* MIDDLE TEXT: Status label + amounts */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span
            className={cn(
              "text-sm font-medium",
              isConfirmed ? "text-white" : isPreConfirmed ? "text-blue-400" : "text-white"
            )}
          >
            {isConfirmed
              ? "Tokens Available"
              : isPreConfirmed
                ? "Tokens Pre-confirmed"
                : "Swapping..."}
          </span>

          {/* Amount Subtext */}
          <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
            {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} → {toast.amountOut ?? "—"}{" "}
            {toast.tokenOut?.symbol}
          </div>
        </div>

        {/* RIGHT ACTION/STATUS */}
        <div className="w-8 flex justify-end items-center relative h-8">
          {isConfirmed || isPreConfirmed ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeToast(hash)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors animate-in zoom-in fade-in duration-500"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          ) : (
            <div className="relative h-5 w-5 flex items-center justify-center shrink-0">
              {/* The Spinner */}
              <div className="h-5 w-5 rounded-full border-2 border-transparent border-t-white animate-spin transition-all duration-700" />

              {/* Background ring for visual depth */}
              <div className="absolute inset-0 rounded-full border-2 border-white/5 pointer-events-none" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
