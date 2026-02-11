import { create } from "zustand"
import type { Token } from "@/types/swap"
import type { TransactionReceipt } from "viem"

export type SwapToastStatus = "pending" | "pre-confirmed" | "confirmed"

export type SwapToast = {
  /** Stable id so key doesn't change when we update hash (Permit path); avoids remount jank. */
  id: string
  hash: string
  status: SwapToastStatus
  collapsed: boolean
  tokenIn?: Token
  tokenOut?: Token
  amountIn?: string
  amountOut?: string
  onConfirm?: () => void
  /** Called when DB has success receipt (pre-confirmation). Use to reset form state. */
  onPreConfirm?: () => void
}

/** Error from a failed tx (status 0x0). Triggers the SwapConfirmationModal error modal. */
export type SwapTxError = {
  message: string
  receipt?: TransactionReceipt
  /** Raw RPC result from DB as returned (unmodified). Shown in Error Log when user clicks. */
  rawDbRecord?: unknown
  /** True when the tx had already reached pre-confirmed before failing (e.g. reverted after DB 0x1). Hide Try Again. */
  occurredAfterPreConfirm?: boolean
}

type Store = {
  toasts: SwapToast[]
  /** Set when a tx fails after submit; SwapConfirmationModal shows error modal. Cleared when modal closes. */
  lastTxError: SwapTxError | null
  /** Hash of the tx that just failed; used to hide its toast immediately. Cleared with lastTxError. */
  failedTxHash: string | null
  addToast: (
    hash: string,
    tokenIn?: Token,
    tokenOut?: Token,
    amountIn?: string,
    amountOut?: string,
    onConfirm?: () => void,
    onPreConfirm?: () => void
  ) => void
  setStatus: (hash: string, status: SwapToastStatus) => void
  /** Removes toast and sets lastTxError for the error modal. */
  setFailed: (
    hash: string,
    receipt?: TransactionReceipt,
    message?: string,
    rawDbRecord?: unknown
  ) => void
  clearLastTxError: () => void
  collapse: (hash: string) => void
  expand: (hash: string) => void
  removeToast: (hash: string) => void
  /** Replace a placeholder hash with the real tx hash (Permit path: show toast before relayer returns). */
  updateToastHash: (placeholderHash: string, realHash: string) => void
}

export const useSwapToastStore = create<Store>((set) => ({
  toasts: [],
  lastTxError: null,
  failedTxHash: null,

  addToast: (hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onPreConfirm) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
          id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          hash,
          status: "pending",
          collapsed: false,
          tokenIn,
          tokenOut,
          amountIn,
          amountOut,
          onConfirm,
          onPreConfirm,
        },
      ],
    })),

  setStatus: (hash, status) =>
    set((s) => ({
      toasts: s.toasts.map((t) => (t.hash === hash ? { ...t, status } : t)),
    })),

  setFailed: (hash, receipt, message, rawDbRecord) =>
    set((s) => {
      const toast = s.toasts.find((t) => t.hash === hash)
      const occurredAfterPreConfirm = toast?.status === "pre-confirmed"
      return {
        toasts: s.toasts.filter((t) => t.hash !== hash),
        lastTxError: {
          message: message ?? "Transaction failed",
          receipt,
          rawDbRecord,
          occurredAfterPreConfirm,
        },
        failedTxHash: hash,
      }
    }),

  clearLastTxError: () => set({ lastTxError: null, failedTxHash: null }),

  collapse: (hash) =>
    set((s) => ({
      toasts: s.toasts.map((t) =>
        t.hash === hash && (t.status === "pending" || t.status === "pre-confirmed")
          ? { ...t, collapsed: true }
          : t
      ),
    })),

  expand: (hash) =>
    set((s) => ({
      toasts: s.toasts.map((t) => (t.hash === hash ? { ...t, collapsed: false } : t)),
    })),

  removeToast: (hash) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.hash !== hash),
    })),

  updateToastHash: (placeholderHash, realHash) =>
    set((s) => ({
      toasts: s.toasts.map((t) => (t.hash === placeholderHash ? { ...t, hash: realHash } : t)),
    })),
}))
