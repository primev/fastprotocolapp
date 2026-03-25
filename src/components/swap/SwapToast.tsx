"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { useWaitForTransactionReceipt } from "wagmi"
import type { TransactionReceipt } from "viem"
import { X, RefreshCw, ExternalLink } from "lucide-react"
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
import { playPreconfirmSound } from "@/lib/preconfirm-sound"
import { cn } from "@/lib/utils"

const CONFIRMED_AUTO_DISMISS_MS = 6000
const SHARE_STRIP_DELAY_S = 1.5

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
        playPreconfirmSound()
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

  useEffect(() => {
    if (toast?.status !== "confirmed") return
    const timer = setTimeout(() => removeToast(hash), CONFIRMED_AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast?.status, hash, removeToast])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!toastRef.current?.contains(e.target as Node) && toast) {
        if (toast.status === "confirmed" || toast.status === "failed") removeToast(hash)
        else collapse(hash)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [hash, toast, collapse, removeToast])

  if (!toast) return null

  const isPending = toast.status === "pending"
  const isPreConfirmed = toast.status === "preconfirmed"
  const isConfirmed = toast.status === "confirmed"
  const isFailed = toast.status === "failed"
  const settled = isPreConfirmed || isConfirmed
  const explorerUrl = effectiveHash
    ? `${FAST_PROTOCOL_NETWORK.blockExplorerUrls[0]}tx/${effectiveHash}`
    : null
  const elapsedSec =
    toast.preconfirmedAt && toast.createdAt
      ? ((toast.preconfirmedAt - toast.createdAt) / 1000).toFixed(1)
      : null

  // ── Failed ────────────────────────────────────────────────────────
  if (isFailed) {
    const barterSlippage = toast.errorMessage ? parseBarterSlippageError(toast.errorMessage) : null

    if (barterSlippage) {
      return (
        <div
          ref={toastRef}
          className="relative w-[360px] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl border border-amber-500/30 animate-in fade-in slide-in-from-right-5 duration-300"
        >
          <div className="relative p-4 flex items-center gap-4">
            <div className="h-11 w-11 shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-amber-400">Slippage too low</span>
              <div className="mt-0.5 text-xs text-neutral-500">
                Minimum required: {barterSlippage.recommendedSlippage}%
              </div>
            </div>
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
              onClick={(e) => { e.stopPropagation(); removeToast(hash) }}
              className="text-neutral-600 hover:text-neutral-300 transition-colors p-1"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={toastRef}
        role="button"
        tabIndex={0}
        onClick={() => showErrorForToast(hash)}
        className="relative w-[360px] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl border border-red-500/30 animate-in fade-in slide-in-from-right-5 duration-300 cursor-pointer"
      >
        <div className="relative h-[84px] p-4 flex items-center gap-4">
          <div className="h-11 w-11 shrink-0 rounded-full bg-red-500/10 flex items-center justify-center">
            <X className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-red-400">Swap Failed</span>
            <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
              {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} → {toast.amountOut ?? "—"}{" "}
              {toast.tokenOut?.symbol}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeToast(hash) }}
            className="text-neutral-600 hover:text-neutral-300 transition-colors p-1"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  // ── Collapsed ─────────────────────────────────────────────────────
  if ((isPending || isPreConfirmed) && toast.collapsed) {
    return (
      <button
        type="button"
        onClick={() => expand(hash)}
        className="flex items-center gap-2 rounded-full bg-neutral-900 border border-white/10 px-3 py-2 shadow-lg"
      >
        {isPreConfirmed ? (
          <Image src="/assets/fast-icon.png" alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
        ) : (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        <span className="text-sm text-white">
          {isPreConfirmed ? "Preconfirmed" : "Swapping"}
        </span>
      </button>
    )
  }

  // ── Main card ─────────────────────────────────────────────────────
  return (
    <motion.div
      ref={toastRef}
      layout
      className={cn(
        "group relative w-[360px] rounded-2xl bg-neutral-900 shadow-2xl transition-colors duration-500 border",
        isConfirmed
          ? "border-green-500/25"
          : isPreConfirmed
            ? "border-blue-500/30"
            : "border-white/10 hover:border-white/20"
      )}
    >
      {/* ── Dismiss: bare X, no bubble ── */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); removeToast(hash) }}
        className="absolute top-2.5 right-3 z-20 text-neutral-600 hover:text-neutral-300 transition-opacity opacity-0 group-hover:opacity-100 p-0.5"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>

      {/* ── Card body ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => explorerUrl && window.open(explorerUrl, "_blank")}
        className={cn("relative h-[84px] p-4 flex items-center gap-4", explorerUrl && settled && "cursor-pointer")}
      >
        {/* LEFT: Icon */}
        <div className="relative h-11 w-11 shrink-0" style={{ overflow: "visible" }}>
          <PreconfirmCelebration active={isPreConfirmed} />
          <PreconfirmGlow active={isPreConfirmed && !isConfirmed} />

          <div
            className={cn(
              "absolute inset-0 transition-all duration-500",
              settled ? "opacity-0 scale-75 -translate-x-8" : "opacity-100 scale-100 translate-x-0"
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          >
            <TokenPairIcon leftToken={toast.tokenIn} rightToken={toast.tokenOut} />
          </div>

          <AnimatePresence>
            {settled && (
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

          {/* Green checkmark badge */}
          <AnimatePresence>
            {isConfirmed && (
              <motion.div
                className="absolute -bottom-0.5 -right-0.5 z-10 h-[18px] w-[18px] rounded-full bg-green-500 border-2 border-neutral-900 flex items-center justify-center"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1, type: "spring", damping: 15, stiffness: 300 }}
              >
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2.5 6 5 8.5 9.5 3.5" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* MIDDLE: Text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {isConfirmed ? (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-sm font-semibold text-green-400">Tokens Available</span>
                <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                  {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} → {toast.amountOut ?? "—"}{" "}
                  {toast.tokenOut?.symbol}
                </div>
              </motion.div>
            ) : isPreConfirmed ? (
              <motion.div
                key="preconfirmed"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-sm font-semibold text-blue-400">Preconfirmed</span>
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

        {/* RIGHT: Speed badge + explorer link */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Speed badge — prominent */}
          <AnimatePresence>
            {settled && elapsedSec && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.3, type: "spring", damping: 15 }}
                className={cn(
                  "px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums",
                  isConfirmed
                    ? "bg-green-500/10 text-green-400"
                    : "bg-blue-500/10 text-blue-400"
                )}
              >
                {elapsedSec}s
              </motion.div>
            )}
          </AnimatePresence>

          {/* Explorer link */}
          {settled && explorerUrl ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center"
            >
              <ExternalLink className={cn(
                "h-4 w-4 transition-colors",
                isConfirmed
                  ? "text-green-400/60 hover:text-green-400"
                  : "text-blue-400/60 hover:text-blue-400"
              )} />
            </motion.div>
          ) : isPending ? (
            <div className="relative h-5 w-5 flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-transparent border-t-white animate-spin" />
              <div className="absolute inset-0 rounded-full border-2 border-white/5 pointer-events-none" />
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Bottom accent line ── */}
      <AnimatePresence>
        {isConfirmed && (
          <motion.div
            className="absolute bottom-0 left-0 h-[2px] bg-green-500/40 rounded-b-2xl"
            initial={{ width: "100%", opacity: 0 }}
            animate={{ width: "0%", opacity: 1 }}
            transition={{ width: { duration: CONFIRMED_AUTO_DISMISS_MS / 1000, ease: "linear" }, opacity: { duration: 0.3 } }}
          />
        )}
        {isPreConfirmed && !isConfirmed && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent rounded-b-2xl"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* ── Share on X: flush strip below card body ── */}
      <AnimatePresence>
        {(isPreConfirmed || isConfirmed) && elapsedSec && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ delay: SHARE_STRIP_DELAY_S, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const secs = parseFloat(elapsedSec!)
                  const fire = secs < 1 ? " \u{1F525}\u{1F525}\u{1F525}" : secs < 4 ? " \u{1F525}\u{1F525}" : " \u{1F525}"

                  // Variations grounded in the actual speed experience
                  const fast = [
                    `I just made a Fast Swap — preconfirmed in ${elapsedSec}s. Didn't even see a spinner.${fire}`,
                    `${elapsedSec}s from sign to preconfirmed. That's a Fast Swap.${fire}`,
                    `Just swapped and it was preconfirmed in ${elapsedSec}s. This is what preconfirmations feel like.${fire}`,
                  ]
                  const mid = [
                    `I just made a Fast Swap — preconfirmed in ${elapsedSec}s before the block even landed.${fire}`,
                    `Swapped and preconfirmed in ${elapsedSec}s. No more watching spinners.${fire}`,
                    `${elapsedSec}s to preconfirmed. Fast Swaps hit different.${fire}`,
                  ]
                  const slow = [
                    `I just made a Fast Swap — preconfirmed in ${elapsedSec}s. Still faster than waiting for a block.${fire}`,
                    `Preconfirmed in ${elapsedSec}s on a Fast Swap. Knew my tokens were secured before L1 confirmed.${fire}`,
                  ]

                  const variants = secs < 1 ? fast : secs < 4 ? mid : slow
                  const text = variants[Math.floor(Math.random() * variants.length)]
                  const tweet = `${text}\n\n@Fast_Protocol`
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
                    "_blank"
                  )
                }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-neutral-500 hover:text-neutral-200 transition-colors"
              >
                <FaXTwitter className="h-3 w-3" />
                <span className="text-[11px] font-medium">Share on X</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
