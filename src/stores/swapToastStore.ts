import { create } from "zustand"
import type { Token } from "@/types/swap"

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
}

type Store = {
  toasts: SwapToast[]
  addToast: (
    hash: string,
    tokenIn?: Token,
    tokenOut?: Token,
    amountIn?: string,
    amountOut?: string,
    onConfirm?: () => void
  ) => void
  setStatus: (hash: string, status: SwapToastStatus) => void
  collapse: (hash: string) => void
  expand: (hash: string) => void
  removeToast: (hash: string) => void
}

export const useSwapToastStore = create<Store>((set) => ({
  toasts: [],

  addToast: (hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm) =>
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
        },
      ],
    })),

  setStatus: (hash, status) =>
    set((s) => ({
      toasts: s.toasts.map((t) => (t.hash === hash ? { ...t, status } : t)),
    })),

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
