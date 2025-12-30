"use client"

import { useState } from 'react'
import { useMarketStore } from '@/hooks/useMarketStore'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MarketRules() {
  const { selectedMarket } = useMarketStore()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!selectedMarket) return null

  const rules = selectedMarket.type === 'crypto'
    ? {
        title: 'Crypto Market Rules',
        summary: 'Predict if the price will be higher (UP) or lower (DOWN) than the opening price when the market closes.',
        details: [
          'Market duration: 15 minutes',
          'Resolution: Based on final price vs opening price',
          'UP wins if final price > opening price',
          'DOWN wins if final price < opening price',
          'In case of exact match, house wins',
          'Payouts are calculated based on odds at time of bet',
        ],
      }
    : {
        title: 'Event Market Rules',
        summary: selectedMarket.resolution || 'Predict the outcome of this event.',
        details: [
          'Resolution based on official sources',
          'Market resolves when outcome is determined',
          'UP = Yes, the event happens',
          'DOWN = No, the event does not happen',
          'Partial outcomes may result in void bets',
          'Payouts are calculated based on odds at time of bet',
        ],
      }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#161b22] to-[#0d1117] border border-white/5 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <svg
              className="h-4 w-4 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <span className="font-semibold text-white">{rules.title}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-gray-400 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">
          {/* Summary */}
          <p className="text-gray-400 text-sm leading-relaxed">
            {rules.summary}
          </p>

          {/* Detailed Rules */}
          <ul className="space-y-2">
            {rules.details.map((detail, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="text-primary mt-1">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>

          {/* Disclaimer */}
          <div className="pt-3 border-t border-white/5">
            <p className="text-xs text-gray-500">
              This is a demo experience. No real funds are involved. All markets
              and outcomes are simulated for demonstration purposes only.
            </p>
          </div>
        </div>
      </div>

      {/* Collapsed Summary */}
      {!isExpanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <p className="text-gray-500 text-sm line-clamp-1">
            {rules.summary}
          </p>
        </div>
      )}
    </div>
  )
}
