"use client"

import { useSwapToastStore } from "@/stores/swapToastStore"
import { SwapToast } from "./SwapToast"

export function SwapToastContainer() {
  const toasts = useSwapToastStore((s) => s.toasts)

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
      {toasts.map((t, i) => (
        <div key={t.hash} style={{ marginTop: i * 12 }}>
          <SwapToast hash={t.hash} />
        </div>
      ))}
    </div>
  )
}
