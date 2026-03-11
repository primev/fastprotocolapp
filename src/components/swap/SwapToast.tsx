"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useWaitForTransactionReceipt } from "wagmi"
import type { TransactionReceipt } from "viem"
import { X } from "lucide-react"
import { useSwapToastStore } from "@/stores/swapToastStore"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import { getTransactionShortMessage, RPCError } from "@/lib/transaction-errors"
import { FAST_PROTOCOL_NETWORK } from "@/lib/network-config"
import { TokenPairIcon } from "./TokenPairIcon"
import { cn } from "@/lib/utils"

const PRE_CONFIRM_DURATION_MS = 6000

/**
 * SwapToast handles the multi-stage lifecycle of a transaction.
 * It uses a "Stage" layout where the Initial/Success views and the Pre-Confirmed
 * views are layered on top of each other and transitioned using CSS transforms.
 */
export function SwapToast({ hash }: { hash: string }) {
  const toast = useSwapToastStore((s) => s.toasts.find((t) => t.hash === hash))
  const setStatus = useSwapToastStore((s) => s.setStatus)
  const setFailed = useSwapToastStore((s) => s.setFailed)
  const showErrorForToast = useSwapToastStore((s) => s.showErrorForToast)
  const collapse = useSwapToastStore((s) => s.collapse)
  const expand = useSwapToastStore((s) => s.expand)
  const removeToast = useSwapToastStore((s) => s.removeToast)

  const toastRef = useRef<HTMLDivElement>(null)

  // Placeholder hash (Permit path) until relayer returns real hash; don't poll until then
  const effectiveHash = hash.startsWith("pending-") ? undefined : hash

  // Controls the "swipe" animation state
  const [showPreConfirmView, setShowPreConfirmView] = useState(false)
  // Hidden after pre-confirm auto-dismiss; hooks keep running. Reappears on confirm/fail.
  const [isHidden, setIsHidden] = useState(false)

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
      setShowPreConfirmView(false) // Immediately exit pre-confirm view on finality
      setIsHidden(false) // Reappear if hidden after pre-confirm auto-dismiss
      const t = useSwapToastStore.getState().toasts.find((x) => x.hash === hash)
      t?.onConfirm?.()
    },
    onPreConfirmed: () => {
      const currentStatus = useSwapToastStore.getState().toasts.find((t) => t.hash === hash)?.status
      // Show pre-confirm unless we already reached final confirmation (e.g. Wagmi won first)
      if (effectiveHash && currentStatus !== "confirmed") {
        setStatus(hash, "pre-confirmed")
        setShowPreConfirmView(true)
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
      setShowPreConfirmView(false)
      setIsHidden(false) // Reappear to show failed state
    },
  })

  // Sync local pre-confirm view from store (onPreConfirmed can run after await; store may update before setState)
  useEffect(() => {
    if (toast?.status === "pre-confirmed") setShowPreConfirmView(true)
  }, [toast?.status])

  // 3. Handle the 6s window for the Pre-Confirmed "Brag" screen
  useEffect(() => {
    if (!toast || toast.status !== "pre-confirmed") return

    const id = setTimeout(() => {
      const currentStatus = useSwapToastStore.getState().toasts.find((t) => t.hash === hash)?.status
      // Don't swipe back if we've already reached final confirmation or failed
      if (currentStatus === "confirmed" || currentStatus === "failed") return
      setShowPreConfirmView(false)
      setIsHidden(true) // Hide toast after pre-confirm auto-dismiss; logic keeps running
    }, PRE_CONFIRM_DURATION_MS)

    return () => clearTimeout(id)
  }, [hash, toast?.status])

  // 4. Click Outside Logic
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
  // Pre-confirm brag (icon swap, ring, progress bar): show when store is pre-confirmed and in 6s window.
  // After 6s showPreConfirmView becomes false to dim (label stays).
  const showPreConfirmBrag = isPreConfirmed && showPreConfirmView
  const explorerUrl = effectiveHash
    ? `${FAST_PROTOCOL_NETWORK.blockExplorerUrls[0]}tx/${effectiveHash}`
    : null

  // Hidden after pre-confirm auto-dismiss; hooks above keep running
  if (isHidden) return null

  // Failed State: Show "Swap Failed" with Details button
  if (isFailed) {
    return (
      <div
        ref={toastRef}
        className="relative w-[360px] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl border border-red-500/30 animate-in fade-in slide-in-from-right-5 duration-300"
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                showErrorForToast(hash)
              }}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors"
            >
              Details
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeToast(hash)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
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
        {/* LEFT ICON STACK: Spatial swap between TokenPair and FastIcon */}
        <div className="relative h-11 w-11 shrink-0 overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)",
              showPreConfirmBrag
                ? "-translate-x-16 opacity-0 scale-75"
                : "translate-x-0 opacity-100 scale-100"
            )}
          >
            <TokenPairIcon leftToken={toast.tokenIn} rightToken={toast.tokenOut} />
          </div>

          <div
            className={cn(
              "absolute inset-0 transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)",
              showPreConfirmBrag
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

        {/* MIDDLE TEXT STACK: Vertical slide for status messages (same 6s window as brag) */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="relative h-5 overflow-hidden">
            <div
              className={cn(
                "absolute inset-0 flex flex-col transition-transform duration-500 ease-in-out",
                showPreConfirmBrag ? "-translate-y-full" : "translate-y-0"
              )}
            >
              {/* Primary Label (Swapping or Complete) */}
              <span className="h-5 text-sm font-medium text-white flex items-center">
                {isConfirmed ? "Tokens Available" : "Swapping..."}
              </span>
              {/* Pre-Confirm Label */}
              <span className="h-5 text-sm font-medium text-blue-400 flex items-center">
                Tokens Pre-confirmed
              </span>
            </div>
          </div>

          {/* Amount Subtext */}
          <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
            {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} → {toast.amountOut ?? "—"}{" "}
            {toast.tokenOut?.symbol}
          </div>
        </div>

        {/* RIGHT ACTION/STATUS */}
        <div className="w-8 flex justify-end items-center relative h-8">
          {isConfirmed ? (
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
              {/* The Spinner - transitions color/glow but doesn't vanish */}
              <div
                className={cn(
                  "h-5 w-5 rounded-full border-2 border-transparent border-t-white animate-spin transition-all duration-700",
                  showPreConfirmBrag && "border-t-blue-400"
                )}
              />

              {/* The Ring Effect - Scales up and fades in during pre-confirm */}
              <div
                className={cn(
                  "absolute -inset-1 rounded-full border border-blue-400/30 transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) scale-50 opacity-0",
                  showPreConfirmBrag && "opacity-100 scale-125"
                )}
              />

              {/* Background ring for visual depth */}
              <div className="absolute inset-0 rounded-full border-2 border-white/5 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Optional: Subtle progress bar at the bottom for the 6s window */}
      {showPreConfirmBrag && (
        <div
          className="absolute bottom-0 left-0 h-[2px] bg-blue-500 animate-progress-shrink"
          style={{ animationDuration: `${PRE_CONFIRM_DURATION_MS}ms` }}
        />
      )}
    </div>
  )
}
