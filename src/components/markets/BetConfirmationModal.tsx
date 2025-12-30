"use client"

import { useEffect } from 'react'
import type { UserBet } from '@/types/market'
import { cn } from '@/lib/utils'

interface BetConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  bet: UserBet | null
}

export function BetConfirmationModal({ isOpen, onClose, bet }: BetConfirmationModalProps) {
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen || !bet) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-sm",
          "bg-gradient-to-br from-[#161b22] to-[#0d1117]",
          "border border-white/10 rounded-2xl",
          "p-6 shadow-2xl",
          "animate-in fade-in slide-in-from-bottom-4 duration-300"
        )}
      >
        {/* Success Icon */}
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-4">
          Prediction Placed!
        </h3>

        {/* Details */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Market</span>
            <span className="text-white font-medium">{bet.marketName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Direction</span>
            <span className={cn(
              "font-bold",
              bet.direction === 'UP' ? "text-green-400" : "text-red-400"
            )}>
              {bet.direction === 'UP' ? '▲' : '▼'} {bet.direction}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Amount</span>
            <span className="text-white font-medium">${bet.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Odds</span>
            <span className="text-white font-medium">{bet.odds.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between text-sm border-t border-white/10 pt-3">
            <span className="text-gray-400">Potential Payout</span>
            <span className="text-green-400 font-bold">${bet.potentialPayout.toFixed(2)}</span>
          </div>
        </div>

        {/* Progress Bar (auto-dismiss indicator) */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary animate-[shrink_3s_linear_forwards]"
            style={{ width: '100%' }}
          />
        </div>

        <style jsx>{`
          @keyframes shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
      </div>
    </div>
  )
}
