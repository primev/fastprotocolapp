"use client"

import { useEffect } from 'react'
import { useMarketStore } from '@/hooks/useMarketStore'
import { MarketPredictor } from './MarketPredictor'
import { MarketBetForm } from './MarketBetForm'
import { MarketRules } from './MarketRules'

export function MarketsPage() {
  const { updateMarketData } = useMarketStore()

  // Live price updates every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      updateMarketData()
    }, 2000)

    return () => clearInterval(interval)
  }, [updateMarketData])

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-0 space-y-6">
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Market Predictor - Takes 3 columns on large screens */}
        <div className="lg:col-span-3">
          <MarketPredictor />
        </div>

        {/* Bet Form - Takes 2 columns on large screens */}
        <div className="lg:col-span-2 space-y-6">
          <MarketBetForm />
          <MarketRules />
        </div>
      </div>

      {/* Demo Disclaimer */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-500">
          This is a demo experience. No real funds or blockchain transactions are involved.
        </p>
      </div>
    </div>
  )
}
