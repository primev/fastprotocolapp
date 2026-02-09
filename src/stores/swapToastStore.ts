import { create } from "zustand"
import type { Token } from "@/types/swap"
import type { TransactionReceipt } from "viem"

export type SwapToastStatus = "pending" | "pre-confirmed" | "confirmed"

export type SwapToast = {
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
export type SwapTxError = { message: string; receipt?: TransactionReceipt }

type Store = {
  toasts: SwapToast[]
  /** Set when a tx fails after submit; SwapConfirmationModal shows error modal. Cleared when modal closes. */
  lastTxError: SwapTxError | null
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
  setFailed: (hash: string, receipt?: TransactionReceipt) => void
  clearLastTxError: () => void
  collapse: (hash: string) => void
  expand: (hash: string) => void
  removeToast: (hash: string) => void
}

export const useSwapToastStore = create<Store>((set) => ({
  toasts: [],
  lastTxError: null,

  addToast: (hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onPreConfirm) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
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

  setFailed: (hash, receipt) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.hash !== hash),
      lastTxError: { message: "RPC Error", receipt },
    })),

  clearLastTxError: () => set({ lastTxError: null }),

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
}))
