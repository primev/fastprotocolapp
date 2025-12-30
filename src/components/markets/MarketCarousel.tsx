"use client"

import { useMarketStore } from '@/hooks/useMarketStore'
import { formatTimeLeft, formatPrice } from '@/lib/mockMarketData'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Clock, Users } from 'lucide-react'

export function MarketCarousel() {
  const { markets, selectedMarket, setSelectedMarket } = useMarketStore()

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Featured Markets</h3>
          <p className="text-sm text-gray-500">Select a market to predict</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-medium text-green-400">Live</span>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
        {markets.map((market) => {
          const isActive = selectedMarket?.id === market.id
          const isUp = market.changePercent >= 0

          return (
            <button
              key={market.id}
              onClick={() => setSelectedMarket(market)}
              className={cn(
                "group flex-shrink-0 w-[280px] sm:w-[320px] snap-start",
                "relative overflow-hidden rounded-2xl",
                "bg-gradient-to-br from-[#1a1f2e] via-[#151923] to-[#0f1218]",
                "border transition-all duration-300 ease-out",
                "hover:scale-[1.02] hover:-translate-y-1",
                isActive
                  ? "border-primary/60 shadow-[0_0_40px_-10px_rgba(56,152,255,0.4)]"
                  : "border-white/[0.06] hover:border-white/[0.12] shadow-xl shadow-black/20"
              )}
            >
              {/* Glow effect for active card */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
              )}

              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_1px)] bg-[length:24px_24px]" />

              <div className="relative p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-xl text-2xl",
                      "bg-gradient-to-br from-white/10 to-white/5",
                      "border border-white/10 shadow-inner"
                    )}>
                      {market.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white text-lg leading-tight">{market.symbol}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{market.name}</div>
                    </div>
                  </div>

                  {/* Time badge */}
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
                    "bg-white/5 border border-white/5"
                  )}>
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-xs font-mono font-medium text-gray-300">
                      {formatTimeLeft(market.timeLeft)}
                    </span>
                  </div>
                </div>

                {/* Price Section */}
                <div className="mb-4">
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {market.type === 'crypto' ? '$' : ''}{formatPrice(market.currentPrice, market.type)}
                  </div>
                  <div className={cn(
                    "flex items-center gap-1.5 mt-1",
                    isUp ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {isUp ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    <span className="text-sm font-semibold">
                      {isUp ? '+' : ''}{market.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Odds Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className={cn(
                    "relative overflow-hidden rounded-xl p-3",
                    "bg-gradient-to-br from-emerald-500/15 to-emerald-600/5",
                    "border border-emerald-500/20"
                  )}>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-400/70 font-medium mb-1">Up</div>
                      <div className="text-lg font-bold text-emerald-400">{market.oddsUp.toFixed(2)}x</div>
                    </div>
                  </div>
                  <div className={cn(
                    "relative overflow-hidden rounded-xl p-3",
                    "bg-gradient-to-br from-rose-500/15 to-rose-600/5",
                    "border border-rose-500/20"
                  )}>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative">
                      <div className="text-[10px] uppercase tracking-wider text-rose-400/70 font-medium mb-1">Down</div>
                      <div className="text-lg font-bold text-rose-400">{market.oddsDown.toFixed(2)}x</div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs">{market.participants.toLocaleString()} trading</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md",
                    "bg-white/5 text-gray-400"
                  )}>
                    {market.type === 'crypto' ? '15min' : 'Event'}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
