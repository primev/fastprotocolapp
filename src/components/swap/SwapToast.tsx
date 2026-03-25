"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { useWaitForTransactionReceipt } from "wagmi"
import type { TransactionReceipt } from "viem"
import { X, RefreshCw, ExternalLink, Check } from "lucide-react"
import { FaXTwitter } from "react-icons/fa6"
import { useSwapToastStore } from "@/stores/swapToastStore"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import {
  getTransactionShortMessage,
  parseBarterSlippageError,
  RPCError,
} from "@/lib/transaction-errors"
import { FAST_PROTOCOL_NETWORK } from "@/lib/network-config"
import { TokenPairIcon } from "./TokenPairIcon"
import { PreconfirmCelebration, PreconfirmGlow } from "./PreconfirmCelebration"
import { cn } from "@/lib/utils"

/** Auto-dismiss delay for "Tokens Available" toast (ms). */
const CONFIRMED_AUTO_DISMISS_MS = 5000

/**
 * SwapToast handles the multi-stage lifecycle of a transaction:
 * pending → preconfirmed → confirmed (or failed at any point).
 *
 * Preconfirmed = hero celebration moment (particles, glow, scale bounce)
 * Confirmed = nonchalant "tokens available" that auto-dismisses
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
        setStatus(hash, "preconfirmed")
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

  // Auto-dismiss confirmed toasts after delay
  useEffect(() => {
    if (toast?.status !== "confirmed") return
    const timer = setTimeout(() => removeToast(hash), CONFIRMED_AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast?.status, hash, removeToast])

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
  const isPreConfirmed = toast.status === "preconfirmed"
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
  if ((isPending || isPreConfirmed) && toast.collapsed) {
    return (
      <button
        type="button"
        onClick={() => expand(hash)}
        className="flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 shadow"
      >
        {isPreConfirmed ? (
          <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
            <Check className="h-3 w-3 text-white" />
          </div>
        ) : (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        <span className="text-sm text-white">
          {isPreConfirmed ? "Preconfirmed" : "Swapping"}
        </span>
      </button>
    )
  }

  // Confirmed = nonchalant auto-dismissing notification
  if (isConfirmed) {
    return (
      <motion.div
        ref={toastRef}
        role="button"
        tabIndex={0}
        onClick={() => explorerUrl && window.open(explorerUrl, "_blank")}
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn(
          "relative w-[360px] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl border border-green-500/20 hover:border-green-500/40 transition-colors",
          explorerUrl ? "cursor-pointer" : "cursor-default"
        )}
      >
        {/* Auto-dismiss progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] bg-green-500/40"
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: CONFIRMED_AUTO_DISMISS_MS / 1000, ease: "linear" }}
        />

        <div className="relative h-[84px] p-4 flex items-center gap-4">
          {/* Green checkmark icon */}
          <motion.div
            className="relative h-11 w-11 shrink-0 flex items-center justify-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="h-11 w-11 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-green-400" />
            </div>
          </motion.div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-sm font-medium text-green-400">Tokens Available</span>
            <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
              {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} → {toast.amountOut ?? "—"}{" "}
              {toast.tokenOut?.symbol}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {explorerUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(explorerUrl, "_blank")
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                aria-label="View on explorer"
              >
                <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
              </button>
            )}
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
      </motion.div>
    )
  }

  // Pending & Preconfirmed states
  return (
    <motion.div
      ref={toastRef}
      role="button"
      tabIndex={0}
      onClick={() => explorerUrl && window.open(explorerUrl, "_blank")}
      layout
      className={cn(
        "relative w-[360px] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl transition-colors duration-300 border",
        isPreConfirmed
          ? "border-blue-500/30 shadow-blue-500/10"
          : "border-white/10 hover:border-white/20",
        explorerUrl ? "cursor-pointer" : "cursor-default"
      )}
    >
      <div className="relative h-[84px] p-4 flex items-center gap-4">
        {/* LEFT ICON: Token pair → Fast logo with celebration */}
        <div className="relative h-11 w-11 shrink-0" style={{ overflow: "visible" }}>
          {/* Celebration particles (fires once on preconfirmed) */}
          <PreconfirmCelebration active={isPreConfirmed} />

          {/* Glow behind logo */}
          <PreconfirmGlow active={isPreConfirmed} />

          {/* Token pair (pending state) */}
          <div
            className={cn(
              "absolute inset-0 transition-all duration-500",
              isPreConfirmed
                ? "opacity-0 scale-75 -translate-x-8"
                : "opacity-100 scale-100 translate-x-0"
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          >
            <TokenPairIcon leftToken={toast.tokenIn} rightToken={toast.tokenOut} />
          </div>

          {/* Fast logo (preconfirmed state) — bounces in with scale */}
          <AnimatePresence>
            {isPreConfirmed && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.3, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{
                  duration: 0.5,
                  ease: [0.2, 0.8, 0.2, 1],
                  scale: { type: "spring", damping: 12, stiffness: 200 },
                }}
              >
                <Image
                  src="/assets/fast-icon.png"
                  alt="Fast Protocol"
                  width={44}
                  height={44}
                  className="h-11 w-11 object-cover rounded-full"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* MIDDLE TEXT: Status label + amounts */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {isPreConfirmed ? (
              <motion.div
                key="preconfirmed"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-sm font-semibold text-blue-400">
                  Preconfirmed
                  {toast.preconfirmedAt && toast.createdAt && (
                    <span className="ml-1.5 text-[11px] font-medium text-blue-300/80">
                      in {((toast.preconfirmedAt - toast.createdAt) / 1000).toFixed(1)}s
                    </span>
                  )}
                </span>
                <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                  {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} → {toast.amountOut ?? "—"}{" "}
                  {toast.tokenOut?.symbol}
                </div>
              </motion.div>
            ) : (
              <motion.div key="pending">
                <span className="text-sm font-medium text-white">Swapping...</span>
                <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                  {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} → {toast.amountOut ?? "—"}{" "}
                  {toast.tokenOut?.symbol}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT ACTION/STATUS */}
        <div className="flex items-center gap-1.5">
          {isPreConfirmed && explorerUrl && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              onClick={(e) => {
                e.stopPropagation()
                window.open(explorerUrl, "_blank")
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
              aria-label="View on explorer"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
            </motion.button>
          )}

          {isPreConfirmed && toast.preconfirmedAt && toast.createdAt && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              onClick={(e) => {
                e.stopPropagation()
                const elapsed = ((toast.preconfirmedAt! - toast.createdAt) / 1000).toFixed(1)
                const tweet = `Just swapped on @Fast_Protocol — preconfirmed in ${elapsed}s\n\nhttps://fastprotocol.xyz`
                window.open(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
                  "_blank"
                )
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
              aria-label="Share on X"
            >
              <FaXTwitter className="h-3.5 w-3.5 text-blue-400" />
            </motion.button>
          )}

          {isPreConfirmed ? (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              onClick={(e) => {
                e.stopPropagation()
                removeToast(hash)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-white" />
            </motion.button>
          ) : (
            <div className="relative h-5 w-5 flex items-center justify-center shrink-0">
              <div className="h-5 w-5 rounded-full border-2 border-transparent border-t-white animate-spin transition-all duration-700" />
              <div className="absolute inset-0 rounded-full border-2 border-white/5 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Preconfirmed: animated blue border glow */}
      {isPreConfirmed && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}
    </motion.div>
  )
}
