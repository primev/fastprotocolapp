"use client"

import { useState, useCallback } from 'react'
import { useMarketStore } from '@/hooks/useMarketStore'
import type { BetDirection, UserBet } from '@/types/market'
import { cn } from '@/lib/utils'
import { BetConfirmationModal } from './BetConfirmationModal'
import { Wallet, TrendingUp, TrendingDown, Sparkles, ArrowRight } from 'lucide-react'

const QUICK_AMOUNTS = [5, 20, 50, 100]

export function MarketBetForm() {
  const { selectedMarket, userBalance, placeBet } = useMarketStore()
  const [betAmount, setBetAmount] = useState<string>('10')
  const [selectedDirection, setSelectedDirection] = useState<BetDirection | null>(null)
  const [lastBet, setLastBet] = useState<UserBet | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const numericAmount = parseFloat(betAmount) || 0
  const isValidAmount = numericAmount > 0 && numericAmount <= userBalance
  const canPlaceBet = isValidAmount && selectedDirection && selectedMarket

  const odds = selectedDirection && selectedMarket
    ? selectedDirection === 'UP' ? selectedMarket.oddsUp : selectedMarket.oddsDown
    : 0
  const potentialPayout = numericAmount * odds
  const profit = potentialPayout - numericAmount

  const handleAmountChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setBetAmount(value)
    }
  }

  const handleQuickAmount = (amount: number) => {
    setBetAmount(amount.toString())
  }

  const handleMaxAmount = () => {
    setBetAmount(Math.floor(userBalance * 100) / 100 + '')
  }

  const handleDirectionSelect = (direction: BetDirection) => {
    setSelectedDirection(direction)
  }

  const handlePlaceBet = useCallback(() => {
    if (!canPlaceBet || !selectedMarket) return

    const bet = placeBet(selectedMarket.id, numericAmount, selectedDirection!)
    if (bet) {
      setLastBet(bet)
      setShowConfirmation(true)
      setBetAmount('10')
      setSelectedDirection(null)
    }
  }, [canPlaceBet, selectedMarket, numericAmount, selectedDirection, placeBet])

  if (!selectedMarket) {
    return null
  }

  return (
    <>
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-[#1a1f2e] via-[#13171f] to-[#0f1218]",
        "border border-white/[0.06]",
        "shadow-2xl shadow-black/20"
      )}>
        {/* Background accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Place Prediction</h3>
              <p className="text-sm text-gray-500 mt-0.5">Choose direction & amount</p>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl",
              "bg-gradient-to-r from-primary/20 to-primary/10",
              "border border-primary/20"
            )}>
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">${userBalance.toFixed(2)}</span>
            </div>
          </div>

          {/* Direction Selection - Moved to top */}
          <div className="mb-6">
            <label className="text-xs uppercase tracking-wider text-gray-500 mb-3 block">
              Your Prediction
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDirectionSelect('UP')}
                className={cn(
                  "group relative overflow-hidden rounded-xl p-4",
                  "transition-all duration-300 ease-out",
                  "border-2",
                  selectedDirection === 'UP'
                    ? "bg-emerald-500/20 border-emerald-500 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)]"
                    : "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10"
                )}
              >
                <div className="flex items-center justify-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg",
                    selectedDirection === 'UP'
                      ? "bg-emerald-500/30"
                      : "bg-emerald-500/10 group-hover:bg-emerald-500/20"
                  )}>
                    <TrendingUp className={cn(
                      "h-5 w-5 transition-transform",
                      selectedDirection === 'UP' ? "text-emerald-400 scale-110" : "text-emerald-400/70"
                    )} />
                  </div>
                  <div className="text-left">
                    <div className={cn(
                      "font-bold",
                      selectedDirection === 'UP' ? "text-emerald-400" : "text-emerald-400/70"
                    )}>UP</div>
                    <div className="text-xs text-emerald-400/50">{selectedMarket.oddsUp.toFixed(2)}x</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleDirectionSelect('DOWN')}
                className={cn(
                  "group relative overflow-hidden rounded-xl p-4",
                  "transition-all duration-300 ease-out",
                  "border-2",
                  selectedDirection === 'DOWN'
                    ? "bg-rose-500/20 border-rose-500 shadow-[0_0_30px_-10px_rgba(244,63,94,0.5)]"
                    : "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/10"
                )}
              >
                <div className="flex items-center justify-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg",
                    selectedDirection === 'DOWN'
                      ? "bg-rose-500/30"
                      : "bg-rose-500/10 group-hover:bg-rose-500/20"
                  )}>
                    <TrendingDown className={cn(
                      "h-5 w-5 transition-transform",
                      selectedDirection === 'DOWN' ? "text-rose-400 scale-110" : "text-rose-400/70"
                    )} />
                  </div>
                  <div className="text-left">
                    <div className={cn(
                      "font-bold",
                      selectedDirection === 'DOWN' ? "text-rose-400" : "text-rose-400/70"
                    )}>DOWN</div>
                    <div className="text-xs text-rose-400/50">{selectedMarket.oddsDown.toFixed(2)}x</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <label className="text-xs uppercase tracking-wider text-gray-500 mb-3 block">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-medium text-gray-400">$</span>
              <input
                type="text"
                value={betAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "w-full pl-10 pr-4 py-4 rounded-xl",
                  "bg-black/30 border-2 transition-all duration-200",
                  "text-2xl font-bold text-white",
                  "placeholder:text-gray-600",
                  "focus:outline-none",
                  numericAmount > userBalance
                    ? "border-rose-500/50 focus:border-rose-500 focus:shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]"
                    : "border-white/10 focus:border-primary focus:shadow-[0_0_20px_-5px_rgba(56,152,255,0.3)]"
                )}
              />
            </div>
            {numericAmount > userBalance && (
              <p className="text-rose-400 text-xs mt-2 flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-rose-400" />
                Insufficient balance
              </p>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 mb-6">
            {QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => handleQuickAmount(amount)}
                disabled={amount > userBalance}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                  "border",
                  parseFloat(betAmount) === amount
                    ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_-5px_rgba(56,152,255,0.4)]"
                    : amount > userBalance
                    ? "bg-white/5 border-white/5 text-gray-600 cursor-not-allowed"
                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                )}
              >
                ${amount}
              </button>
            ))}
            <button
              onClick={handleMaxAmount}
              className={cn(
                "px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                "bg-gradient-to-r from-white/10 to-white/5",
                "border border-white/10 text-gray-300",
                "hover:from-white/15 hover:to-white/10 hover:text-white"
              )}
            >
              MAX
            </button>
          </div>

          {/* Payout Info */}
          {selectedDirection && numericAmount > 0 && (
            <div className={cn(
              "mb-6 p-4 rounded-xl",
              "bg-gradient-to-br from-white/[0.03] to-transparent",
              "border border-white/5"
            )}>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Your stake</span>
                  <span className="text-sm font-medium text-white">${numericAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Multiplier</span>
                  <span className={cn(
                    "text-sm font-bold",
                    selectedDirection === 'UP' ? "text-emerald-400" : "text-rose-400"
                  )}>{odds.toFixed(2)}x</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Potential return
                  </span>
                  <span className="text-lg font-bold text-emerald-400">${potentialPayout.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Profit</span>
                  <span className="text-sm font-semibold text-emerald-400">+${profit.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handlePlaceBet}
            disabled={!canPlaceBet}
            className={cn(
              "w-full py-4 rounded-xl font-bold text-lg transition-all duration-300",
              "flex items-center justify-center gap-2",
              canPlaceBet
                ? "bg-gradient-to-r from-pink-500 via-primary to-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
                : "bg-white/10 text-gray-500 cursor-not-allowed"
            )}
          >
            {!selectedDirection ? (
              "Select a Direction"
            ) : !isValidAmount ? (
              numericAmount > userBalance ? "Insufficient Balance" : "Enter Amount"
            ) : (
              <>
                Place {selectedDirection} Prediction
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>

          {/* Fee notice */}
          <p className="text-center text-xs text-gray-600 mt-3">
            <span className="text-emerald-400 font-medium">Zero fees</span> · Demo mode
          </p>
        </div>
      </div>

      <BetConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        bet={lastBet}
      />
    </>
  )
}
