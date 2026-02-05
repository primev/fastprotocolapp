"use client"

import { useEffect, useRef } from "react"
import { usePublicClient } from "wagmi"
import { mainnet } from "wagmi/chains"
import { useSwapToastStore } from "@/stores/swapToastStore"
import { TokenPairIcon } from "./TokenPairIcon"

export function SwapToast({ hash }: { hash: string }) {
  const client = usePublicClient({ chainId: mainnet.id })

  const toast = useSwapToastStore((s) => s.toasts.find((t) => t.hash === hash))
  const setStatus = useSwapToastStore((s) => s.setStatus)
  const collapse = useSwapToastStore((s) => s.collapse)
  const expand = useSwapToastStore((s) => s.expand)
  const removeToast = useSwapToastStore((s) => s.removeToast)

  const toastRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!toast || toast.status !== "pending" || !client) return

    let cancelled = false
    client
      .waitForTransactionReceipt({ hash: hash as `0x${string}` })
      .then(() => {
        if (!cancelled) {
          const t = useSwapToastStore.getState().toasts.find((x) => x.hash === hash)
          setStatus(hash, "confirmed")
          t?.onConfirm?.()
        }
      })
      .catch(() => {
        // Ignore receipt errors; toast stays pending
      })

    return () => {
      cancelled = true
    }
  }, [hash, toast?.status, client, setStatus])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!toastRef.current?.contains(e.target as Node) && toast) {
        toast.status === "pending" ? collapse(hash) : removeToast(hash)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [hash, toast, collapse, removeToast])

  if (!toast) return null

  // Collapsed pending indicator
  if (toast.status === "pending" && toast.collapsed) {
    return (
      <button
        type="button"
        onClick={() => expand(hash)}
        className="flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 shadow"
      >
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <span className="text-sm text-white">Pending</span>
      </button>
    )
  }

  const explorerUrl = `https://etherscan.io/tx/${hash}`

  return (
    <div
      ref={toastRef}
      role="button"
      tabIndex={0}
      onClick={() => window.open(explorerUrl, "_blank")}
      className="relative w-[320px] cursor-pointer rounded-2xl bg-neutral-900 p-4 shadow-xl transition hover:bg-neutral-800 border border-black/50 border-[1px]"
    >
      <div className="flex items-center gap-3">
        <TokenPairIcon leftToken={toast.tokenIn} rightToken={toast.tokenOut} />

        <div className="flex-1">
          <div className="text-sm text-white">
            {toast.status === "pending" ? "Swapping" : "Swap complete"}
          </div>

          {/* Swap summary - only show when we have amounts */}
          {(toast.amountIn != null || toast.amountOut != null) && (
            <div className="mt-0.5 text-xs text-neutral-400">
              {toast.amountIn ?? "—"} {toast.tokenIn?.symbol} for {toast.amountOut ?? "—"}{" "}
              {toast.tokenOut?.symbol}
            </div>
          )}
        </div>

        {toast.status === "pending" && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
          />
        )}
      </div>
    </div>
  )
}
