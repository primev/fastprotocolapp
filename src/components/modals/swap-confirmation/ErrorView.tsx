"use client"

import { ChevronRight, RefreshCw } from "lucide-react"
import {
  getTransactionShortMessage,
  parseBarterSlippageError,
} from "@/lib/settlement/transaction-errors"

export interface ErrorViewProps {
  error: Error
  /**
   * When true, the swap already preconfirmed before failing (e.g. DB 0x0 after
   * a 0x1). Try Again is hidden because the tx has already been accepted on L1.
   */
  occurredAfterPreConfirm?: boolean
  onOpenDetails: () => void
  onRetry: () => void
  onRetryWithSlippage?: (recommendedSlippage: string) => void
}

// Error view for the swap confirmation modal. Two layouts:
//   1. Barter-slippage failure → surface the recommended slippage % and a
//      Retry button that reopens the main modal pre-bumped to that value.
//   2. Generic failure → short message + Try Again (hidden when the failure
//      happened after preconfirmation, because the tx is already on L1).
export function ErrorView({
  error,
  occurredAfterPreConfirm,
  onOpenDetails,
  onRetry,
  onRetryWithSlippage,
}: ErrorViewProps) {
  const barterSlippageInfo = parseBarterSlippageError(error.message)

  if (barterSlippageInfo) {
    return (
      <div className="flex flex-col items-center pb-10 px-8 text-center animate-in fade-in duration-300">
        <p className="text-[14px] font-medium text-white/75 max-w-[320px] leading-relaxed mb-2">
          Slippage too low for this swap.
        </p>
        <p className="text-[13px] text-zinc-400 max-w-[300px] leading-relaxed mb-6">
          Minimum required slippage:{" "}
          <span className="text-white font-semibold">
            {barterSlippageInfo.recommendedSlippage}%
          </span>
        </p>
        <button
          type="button"
          onClick={() => onRetryWithSlippage?.(barterSlippageInfo.recommendedSlippage)}
          className="w-full h-14 bg-[#3898FF] hover:bg-[#3898FF]/90 text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl transition-all flex items-center justify-center gap-3 mb-3"
        >
          <RefreshCw size={16} /> Retry with {barterSlippageInfo.recommendedSlippage}% slippage
        </button>
        <button
          onClick={onOpenDetails}
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-all"
        >
          View Error Details
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center pb-10 px-8 text-center animate-in fade-in duration-300">
      <p className="text-[14px] font-medium text-white/75 max-w-[320px] leading-relaxed mb-6">
        {getTransactionShortMessage(error)}
      </p>
      <button
        onClick={onOpenDetails}
        className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-all mb-6"
      >
        View Error Details
        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </button>
      {!occurredAfterPreConfirm && (
        <button
          type="button"
          onClick={onRetry}
          className="w-full h-14 bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl transition-all flex items-center justify-center gap-3"
        >
          <RefreshCw size={16} /> Try Again
        </button>
      )}
    </div>
  )
}
