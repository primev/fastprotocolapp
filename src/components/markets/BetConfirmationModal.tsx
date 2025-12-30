"use client"

import { useEffect, useState } from 'react'
import type { UserBet } from '@/types/market'
import { cn } from '@/lib/utils'
import { CheckCircle2, TrendingUp, TrendingDown, Sparkles, X } from 'lucide-react'

interface BetConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  bet: UserBet | null
}

export function BetConfirmationModal({ isOpen, onClose, bet }: BetConfirmationModalProps) {
  const [progress, setProgress] = useState(100)

  // Auto-dismiss countdown
  useEffect(() => {
    if (isOpen) {
      setProgress(100)
      const startTime = Date.now()
      const duration = 3000

      const updateProgress = () => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
        setProgress(remaining)

        if (remaining > 0) {
          requestAnimationFrame(updateProgress)
        } else {
          onClose()
        }
      }

      const animationId = requestAnimationFrame(updateProgress)
      return () => cancelAnimationFrame(animationId)
    }
  }, [isOpen, onClose])

  if (!isOpen || !bet) return null

  const isUp = bet.direction === 'UP'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-sm overflow-hidden",
          "bg-gradient-to-br from-[#1a1f2e] via-[#13171f] to-[#0f1218]",
          "border border-white/[0.08] rounded-2xl",
          "shadow-2xl shadow-black/40",
          "animate-in fade-in slide-in-from-bottom-4 duration-300"
        )}
      >
        {/* Background glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className={cn(
            "absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl",
            isUp ? "bg-emerald-500/20" : "bg-rose-500/20"
          )} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors z-10"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>

        <div className="relative p-6">
          {/* Success Icon with animation */}
          <div className="flex justify-center mb-5">
            <div className={cn(
              "relative h-20 w-20 rounded-full flex items-center justify-center",
              "bg-gradient-to-br",
              isUp ? "from-emerald-500/30 to-emerald-600/10" : "from-rose-500/30 to-rose-600/10"
            )}>
              {/* Animated ring */}
              <div className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-30",
                isUp ? "bg-emerald-500/30" : "bg-rose-500/30"
              )} />
              <div className={cn(
                "absolute inset-2 rounded-full",
                isUp ? "bg-emerald-500/20" : "bg-rose-500/20"
              )} />
              <CheckCircle2 className={cn(
                "h-10 w-10 relative z-10",
                isUp ? "text-emerald-400" : "text-rose-400"
              )} />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-1">
              Prediction Placed!
            </h3>
            <p className="text-sm text-gray-500">Your position is now active</p>
          </div>

          {/* Bet Details Card */}
          <div className={cn(
            "rounded-xl p-4 mb-5",
            "bg-gradient-to-br from-white/[0.04] to-transparent",
            "border border-white/[0.06]"
          )}>
            <div className="space-y-3">
              {/* Market */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Market</span>
                <span className="text-sm font-semibold text-white">{bet.marketName}</span>
              </div>

              {/* Direction */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Direction</span>
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
                  isUp ? "bg-emerald-500/15" : "bg-rose-500/15"
                )}>
                  {isUp ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span className={cn(
                    "text-sm font-bold",
                    isUp ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {bet.direction}
                  </span>
                </div>
              </div>

              {/* Amount */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Stake</span>
                <span className="text-sm font-semibold text-white">${bet.amount.toFixed(2)}</span>
              </div>

              {/* Odds */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Multiplier</span>
                <span className={cn(
                  "text-sm font-bold",
                  isUp ? "text-emerald-400" : "text-rose-400"
                )}>
                  {bet.odds.toFixed(2)}x
                </span>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Potential Payout */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Potential Return
                </span>
                <span className="text-lg font-bold text-emerald-400">
                  ${bet.potentialPayout.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onClose}
            className={cn(
              "w-full py-3.5 rounded-xl font-semibold transition-all duration-200",
              "bg-gradient-to-r from-white/10 to-white/5",
              "border border-white/10 text-white",
              "hover:from-white/15 hover:to-white/10 hover:border-white/20"
            )}
          >
            Continue Trading
          </button>
        </div>

        {/* Progress Bar (auto-dismiss indicator) */}
        <div className="h-1 bg-white/5">
          <div
            className={cn(
              "h-full transition-all duration-100",
              "bg-gradient-to-r",
              isUp ? "from-emerald-400 to-emerald-500" : "from-rose-400 to-rose-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
