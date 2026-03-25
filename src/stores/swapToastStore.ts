import { create } from "zustand"
import type { Token } from "@/types/swap"
import type { TransactionReceipt } from "viem"

export type SwapToastStatus = "pending" | "preconfirmed" | "confirmed" | "failed"

export type SwapToast = {
  /** Stable id so key doesn't change when we update hash (Permit path); avoids remount jank. */
  id: string
  hash: string
  status: SwapToastStatus
  collapsed: boolean
  /** Timestamp when toast was created (pending). Used for elapsed time display. */
  createdAt: number
  /** Timestamp when preconfirmed status was set. Freezes the elapsed timer. */
  preconfirmedAt?: number
  tokenIn?: Token
  tokenOut?: Token
  amountIn?: string
  amountOut?: string
  onConfirm?: () => void
  /** Called when DB has success receipt (preconfirmation). Use to reset form state. */
  onPreConfirm?: () => void
  /** Error info stored on toast when tx fails (status "failed"). */
  errorMessage?: string
  errorReceipt?: TransactionReceipt
  errorRawDbRecord?: unknown
  occurredAfterPreConfirm?: boolean
}

/** Error from a failed tx (status 0x0). Triggers the SwapConfirmationModal error modal. */
export type SwapTxError = {
  message: string
  receipt?: TransactionReceipt
  /** Raw RPC result from DB as returned (unmodified). Shown in Error Log when user clicks. */
  rawDbRecord?: unknown
  /** True when the tx had already reached preconfirmed before failing (e.g. reverted after DB 0x1). Hide Try Again. */
  occurredAfterPreConfirm?: boolean
}

type Store = {
  toasts: SwapToast[]
  /** Set when a tx fails after submit; SwapConfirmationModal shows error modal. Cleared when modal closes. */
  lastTxError: SwapTxError | null
  /** Set when user clicks "Retry with X%" on a barter slippage toast. SwapForm subscribes and reopens modal. */
  retrySlippage: string | null
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
  /** Marks toast as failed and stores error info. Toast stays visible with "Swap Failed" state. */
  setFailed: (
    hash: string,
    receipt?: TransactionReceipt,
    message?: string,
    rawDbRecord?: unknown
  ) => void
  /** Opens the error modal by setting lastTxError from the toast's stored error data. */
  showErrorForToast: (hash: string) => void
  clearLastTxError: () => void
  /** Removes the failed toast and sets retrySlippage so SwapForm can reopen the modal with updated slippage. */
  requestRetryWithSlippage: (hash: string, slippage: string) => void
  clearRetrySlippage: () => void
  collapse: (hash: string) => void
  expand: (hash: string) => void
  removeToast: (hash: string) => void
  /** Replace a placeholder hash with the real tx hash (Permit path: show toast before relayer returns). */
  updateToastHash: (placeholderHash: string, realHash: string) => void
}

export const useSwapToastStore = create<Store>((set, get) => ({
  toasts: [],
  lastTxError: null,
  retrySlippage: null,

  addToast: (hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onPreConfirm) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
          id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          hash,
          status: "pending",
          collapsed: false,
          createdAt: Date.now(),
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
      toasts: s.toasts.map((t) =>
        t.hash === hash
          ? {
              ...t,
              status,
              ...(status === "preconfirmed" && !t.preconfirmedAt ? { preconfirmedAt: Date.now() } : {}),
            }
          : t
      ),
    })),

  setFailed: (hash, receipt, message, rawDbRecord) =>
    set((s) => {
      const toast = s.toasts.find((t) => t.hash === hash)
      const occurredAfterPreConfirm = toast?.status === "preconfirmed"
      return {
        toasts: s.toasts.map((t) =>
          t.hash === hash
            ? {
                ...t,
                status: "failed" as const,
                collapsed: false,
                errorMessage: message ?? "Transaction failed",
                errorReceipt: receipt,
                errorRawDbRecord: rawDbRecord,
                occurredAfterPreConfirm,
              }
            : t
        ),
      }
    }),

  showErrorForToast: (hash) => {
    const toast = get().toasts.find((t) => t.hash === hash)
    if (!toast) return
    set({
      lastTxError: {
        message: toast.errorMessage ?? "Transaction failed",
        receipt: toast.errorReceipt,
        rawDbRecord: toast.errorRawDbRecord,
        occurredAfterPreConfirm: toast.occurredAfterPreConfirm,
      },
    })
  },

  clearLastTxError: () => set({ lastTxError: null }),

  requestRetryWithSlippage: (hash, slippage) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.hash !== hash),
      retrySlippage: slippage,
    })),

  clearRetrySlippage: () => set({ retrySlippage: null }),

  collapse: (hash) =>
    set((s) => ({
      toasts: s.toasts.map((t) =>
        t.hash === hash && (t.status === "pending" || t.status === "preconfirmed")
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
