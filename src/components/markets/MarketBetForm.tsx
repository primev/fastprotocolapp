"use client"

import { useState, useCallback } from 'react'
import { useMarketStore } from '@/hooks/useMarketStore'
import type { BetDirection, UserBet } from '@/types/market'
import { cn } from '@/lib/utils'
import { BetConfirmationModal } from './BetConfirmationModal'

const QUICK_AMOUNTS = [5, 20, 100]

export function MarketBetForm() {
  const { selectedMarket, userBalance, placeBet } = useMarketStore()
  const [betAmount, setBetAmount] = useState<string>('5')
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
    // Allow empty string or valid numbers
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
      // Reset form
      setBetAmount('5')
      setSelectedDirection(null)
    }
  }, [canPlaceBet, selectedMarket, numericAmount, selectedDirection, placeBet])

  if (!selectedMarket) {
    return null
  }

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-[#161b22] to-[#0d1117] border border-white/5 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Place Your Prediction</h3>
          <div className="text-right">
            <div className="text-xs text-gray-400">Balance</div>
            <div className="text-lg font-bold text-primary">${userBalance.toFixed(2)}</div>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-2 block">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
            <input
              type="text"
              value={betAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className={cn(
                "w-full pl-8 pr-4 py-3 rounded-xl",
                "bg-black/30 border-2 transition-all",
                "text-white text-lg font-medium",
                "placeholder:text-gray-600",
                "focus:outline-none",
                numericAmount > userBalance
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-white/10 focus:border-primary focus:shadow-[0_0_20px_rgba(56,152,255,0.15)]"
              )}
            />
          </div>
          {numericAmount > userBalance && (
            <p className="text-red-400 text-xs mt-1">Insufficient balance</p>
          )}
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2 mb-6">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handleQuickAmount(amount)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                "border",
                parseFloat(betAmount) === amount
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              +${amount}
            </button>
          ))}
          <button
            onClick={handleMaxAmount}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
              "bg-white/5 border border-white/10 text-gray-400",
              "hover:bg-white/10 hover:text-white"
            )}
          >
            Max
          </button>
        </div>

        {/* Direction Selection */}
        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-2 block">Direction</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDirectionSelect('UP')}
              className={cn(
                "p-4 rounded-xl transition-all duration-200",
                "border-2",
                selectedDirection === 'UP'
                  ? "bg-green-500/20 border-green-500 shadow-[0_0_20px_rgba(0,217,130,0.2)]"
                  : "bg-green-500/5 border-green-500/20 hover:border-green-500/40"
              )}
            >
              <div className="text-2xl mb-1">▲</div>
              <div className="text-green-400 font-bold">UP</div>
              <div className="text-green-400/70 text-sm">{selectedMarket.oddsUp.toFixed(2)}x</div>
            </button>

            <button
              onClick={() => handleDirectionSelect('DOWN')}
              className={cn(
                "p-4 rounded-xl transition-all duration-200",
                "border-2",
                selectedDirection === 'DOWN'
                  ? "bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(255,107,107,0.2)]"
                  : "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
              )}
            >
              <div className="text-2xl mb-1">▼</div>
              <div className="text-red-400 font-bold">DOWN</div>
              <div className="text-red-400/70 text-sm">{selectedMarket.oddsDown.toFixed(2)}x</div>
            </button>
          </div>
        </div>

        {/* Payout Info */}
        {selectedDirection && (
          <div className="mb-6 p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Potential Payout</span>
              <span className="text-green-400 font-bold">${potentialPayout.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Profit</span>
              <span className={cn(
                "font-medium",
                profit > 0 ? "text-green-400" : "text-gray-400"
              )}>
                +${profit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fee</span>
              <span className="text-green-400 font-medium">FREE</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handlePlaceBet}
          disabled={!canPlaceBet}
          className={cn(
            "w-full py-4 rounded-xl font-bold text-lg transition-all",
            canPlaceBet
              ? "bg-gradient-to-r from-pink-500 to-primary text-white hover:opacity-90 active:scale-[0.98]"
              : "bg-white/10 text-gray-500 cursor-not-allowed"
          )}
        >
          {!selectedDirection
            ? "Select a Direction"
            : !isValidAmount
            ? numericAmount > userBalance
              ? "Insufficient Balance"
              : "Enter an Amount"
            : `Predict ${selectedDirection}`}
        </button>
      </div>

      {/* Confirmation Modal */}
      <BetConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        bet={lastBet}
      />
    </>
  )
}
