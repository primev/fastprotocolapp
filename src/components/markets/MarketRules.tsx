"use client"

import { useState } from 'react'
import { useMarketStore } from '@/hooks/useMarketStore'
import { ChevronDown, Info, Clock, Trophy, Scale, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MarketRules() {
  const { selectedMarket } = useMarketStore()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!selectedMarket) return null

  const rules = selectedMarket.type === 'crypto'
    ? {
        title: 'Market Rules',
        summary: 'Predict if the price will be higher (UP) or lower (DOWN) than the opening price when the market closes.',
        details: [
          { icon: Clock, text: 'Market duration: 15 minutes' },
          { icon: Trophy, text: 'Resolution: Based on final price vs opening price' },
          { icon: CheckCircle2, text: 'UP wins if final price > opening price', color: 'emerald' },
          { icon: CheckCircle2, text: 'DOWN wins if final price < opening price', color: 'rose' },
          { icon: Scale, text: 'In case of exact match, house wins' },
          { icon: AlertCircle, text: 'Payouts calculated at time of bet' },
        ],
      }
    : {
        title: 'Event Rules',
        summary: selectedMarket.resolution || 'Predict the outcome of this event.',
        details: [
          { icon: Info, text: 'Resolution based on official sources' },
          { icon: Clock, text: 'Market resolves when outcome is determined' },
          { icon: CheckCircle2, text: 'UP = Yes, the event happens', color: 'emerald' },
          { icon: CheckCircle2, text: 'DOWN = No, the event does not happen', color: 'rose' },
          { icon: Scale, text: 'Partial outcomes may result in void bets' },
          { icon: AlertCircle, text: 'Payouts calculated at time of bet' },
        ],
      }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl",
      "bg-gradient-to-br from-[#1a1f2e] via-[#13171f] to-[#0f1218]",
      "border border-white/[0.06]",
      "shadow-xl shadow-black/10"
    )}>
      {/* Subtle background accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      {/* Header Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "relative w-full p-5 flex items-center justify-between",
          "transition-colors duration-200",
          "hover:bg-white/[0.02]"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl",
            "bg-gradient-to-br from-primary/20 to-primary/5",
            "border border-primary/20"
          )}>
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-white block">{rules.title}</span>
            <span className="text-xs text-gray-500">Tap to {isExpanded ? 'collapse' : 'expand'}</span>
          </div>
        </div>
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg",
          "bg-white/5 border border-white/5",
          "transition-colors duration-200",
          isExpanded && "bg-primary/10 border-primary/20"
        )}>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform duration-300",
              isExpanded && "rotate-180 text-primary"
            )}
          />
        </div>
      </button>

      {/* Expanded Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-5 pb-5 space-y-4">
          {/* Summary Card */}
          <div className={cn(
            "p-4 rounded-xl",
            "bg-gradient-to-br from-white/[0.03] to-transparent",
            "border border-white/5"
          )}>
            <p className="text-gray-300 text-sm leading-relaxed">
              {rules.summary}
            </p>
          </div>

          {/* Detailed Rules */}
          <div className="space-y-2">
            {rules.details.map((detail, index) => {
              const IconComponent = detail.icon
              const iconColor = detail.color === 'emerald'
                ? 'text-emerald-400'
                : detail.color === 'rose'
                ? 'text-rose-400'
                : 'text-gray-500'

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    "bg-white/[0.02] hover:bg-white/[0.04]",
                    "transition-colors duration-200"
                  )}
                >
                  <IconComponent className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
                  <span className="text-sm text-gray-400">{detail.text}</span>
                </div>
              )
            })}
          </div>

          {/* Disclaimer */}
          <div className={cn(
            "pt-4 border-t border-white/5"
          )}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-600 leading-relaxed">
                Demo experience only. No real funds or blockchain transactions involved.
                Markets and outcomes are simulated for demonstration.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsed Preview */}
      {!isExpanded && (
        <div className="px-5 pb-5">
          <p className="text-gray-500 text-sm line-clamp-2">
            {rules.summary}
          </p>
        </div>
      )}
    </div>
  )
}
