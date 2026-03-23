"use client"

import { useEffect } from "react"
import { useSwapToastStore } from "@/stores/swapToastStore"
import { SwapToast } from "./SwapToast"
import { FEATURE_FLAGS, TEST_SWAP_TOAST_PLACEHOLDER } from "@/lib/feature-flags"

export function SwapToastContainer() {
  const toasts = useSwapToastStore((s) => s.toasts)
  const addToast = useSwapToastStore((s) => s.addToast)

  useEffect(() => {
    if (FEATURE_FLAGS.test_swap_toast) {
      const exists = useSwapToastStore
        .getState()
        .toasts.some((t) => t.hash === TEST_SWAP_TOAST_PLACEHOLDER.hash)
      if (!exists) {
        addToast(
          TEST_SWAP_TOAST_PLACEHOLDER.hash,
          TEST_SWAP_TOAST_PLACEHOLDER.tokenIn,
          TEST_SWAP_TOAST_PLACEHOLDER.tokenOut,
          TEST_SWAP_TOAST_PLACEHOLDER.amountIn,
          TEST_SWAP_TOAST_PLACEHOLDER.amountOut
        )
      }
    }
  }, [addToast])

  return (
    <div className="fixed top-[100px] right-4 z-50 flex flex-col items-end">
      {toasts.map((t, i) => (
        <div key={t.id} style={{ marginTop: i * 12 }}>
          <SwapToast hash={t.hash} />
        </div>
      ))}
    </div>
  )
}
