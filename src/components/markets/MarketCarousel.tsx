"use client"

import { useMarketStore } from '@/hooks/useMarketStore'
import { formatTimeLeft, formatPrice } from '@/lib/mockMarketData'
import { cn } from '@/lib/utils'

export function MarketCarousel() {
  const { markets, selectedMarket, setSelectedMarket } = useMarketStore()

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Featured Markets</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {markets.map((market) => {
          const isActive = selectedMarket?.id === market.id
          const isUp = market.changePercent >= 0

          return (
            <button
              key={market.id}
              onClick={() => setSelectedMarket(market)}
              className={cn(
                "flex-shrink-0 w-[240px] sm:w-[280px] p-4 rounded-xl",
                "bg-gradient-to-br from-[#161b22] to-[#0d1117]",
                "border-2 transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-lg",
                isActive
                  ? "border-primary shadow-[0_0_20px_rgba(56,152,255,0.15)]"
                  : "border-white/5 hover:border-white/10"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{market.icon}</span>
                  <div className="text-left">
                    <div className="font-semibold text-white">{market.symbol}</div>
                    <div className="text-xs text-gray-500">{market.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-[10px] text-gray-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  {formatTimeLeft(market.timeLeft)}
                </div>
              </div>

              {/* Price */}
              <div className="text-left mb-3">
                <div className="text-xl font-bold text-white">
                  {market.type === 'crypto' ? '$' : ''}{formatPrice(market.currentPrice, market.type)}
                </div>
                <div className={cn(
                  "text-sm font-medium",
                  isUp ? "text-green-400" : "text-red-400"
                )}>
                  {isUp ? '↑' : '↓'} {Math.abs(market.changePercent).toFixed(2)}%
                </div>
              </div>

              {/* Odds */}
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-[10px] text-gray-400 uppercase">Up</div>
                  <div className="text-sm font-bold text-green-400">{market.oddsUp.toFixed(2)}x</div>
                </div>
                <div className="flex-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="text-[10px] text-gray-400 uppercase">Down</div>
                  <div className="text-sm font-bold text-red-400">{market.oddsDown.toFixed(2)}x</div>
                </div>
              </div>

              {/* Market type label */}
              <div className="mt-3 text-center">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  {market.type === 'crypto' ? '15min UP or DOWN' : 'Event Market'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
