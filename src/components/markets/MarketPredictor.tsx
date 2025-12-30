"use client"

import { useMemo } from 'react'
import { useMarketStore } from '@/hooks/useMarketStore'
import { formatTimeLeft, formatPrice, formatChange } from '@/lib/mockMarketData'
import { cn } from '@/lib/utils'

interface SparklineProps {
  data: number[]
  isUp: boolean
  width?: number
  height?: number
}

function Sparkline({ data, isUp, width = 400, height = 120 }: SparklineProps) {
  const pathData = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '' }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 20) - 10
      return { x, y }
    })

    // Create smooth curve
    const linePath = points.reduce((path, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`
      return `${path} L ${point.x} ${point.y}`
    }, '')

    // Create filled area
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

    return { linePath, areaPath }
  }, [data, width, height])

  const color = isUp ? '#00d982' : '#ff6b6b'
  const gradientId = isUp ? 'gradient-up' : 'gradient-down'

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Filled area */}
      <path
        d={pathData.areaPath}
        fill={`url(#${gradientId})`}
      />

      {/* Line */}
      <path
        d={pathData.linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current price dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * (height - 20) - 10}
          r="4"
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  )
}

export function MarketPredictor() {
  const { selectedMarket } = useMarketStore()

  if (!selectedMarket) {
    return (
      <div className="p-8 text-center text-gray-500">
        Select a market to view details
      </div>
    )
  }

  const isUp = selectedMarket.changePercent >= 0

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#161b22] to-[#0d1117] border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-4xl animate-pulse">{selectedMarket.icon}</span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{selectedMarket.name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{selectedMarket.type === 'crypto' ? '15min Prediction' : 'Event Market'}</span>
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  LIVE
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Time Left</div>
            <div className="text-lg font-mono font-bold text-white">
              {formatTimeLeft(selectedMarket.timeLeft)}
            </div>
          </div>
        </div>
      </div>

      {/* Price Display */}
      <div className="p-4 sm:p-6 border-b border-white/5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-gray-400 mb-1">Current Price</div>
            <div className="text-3xl sm:text-4xl font-bold text-white transition-transform">
              {selectedMarket.type === 'crypto' ? '$' : ''}{formatPrice(selectedMarket.currentPrice, selectedMarket.type)}
            </div>
            <div className={cn(
              "flex items-center gap-2 mt-1 text-lg font-medium",
              isUp ? "text-green-400" : "text-red-400"
            )}>
              <span className={cn(
                "transition-transform",
                isUp ? "animate-bounce" : "animate-bounce"
              )}>
                {isUp ? '▲' : '▼'}
              </span>
              <span>{formatChange(selectedMarket.change, selectedMarket.type)}</span>
              <span className="text-sm">({isUp ? '+' : ''}{selectedMarket.changePercent.toFixed(2)}%)</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400 mb-1">Opening Price</div>
            <div className="text-xl text-gray-300">
              {selectedMarket.type === 'crypto' ? '$' : ''}{formatPrice(selectedMarket.openingPrice, selectedMarket.type)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {selectedMarket.participants.toLocaleString()} participants
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 sm:p-6 bg-black/20">
        <Sparkline
          data={selectedMarket.trend}
          isUp={isUp}
          height={120}
        />
      </div>

      {/* Prediction Buttons */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4">
          <button
            className={cn(
              "p-4 rounded-xl transition-all duration-200",
              "bg-gradient-to-br from-green-500/20 to-green-600/10",
              "border-2 border-green-500/30",
              "hover:border-green-500/50 hover:-translate-y-0.5",
              "hover:shadow-[0_0_20px_rgba(0,217,130,0.2)]",
              "group"
            )}
          >
            <div className="text-green-400 font-bold text-lg group-hover:scale-105 transition-transform">
              ▲ Predict UP
            </div>
            <div className="text-green-400/70 text-sm mt-1">
              {selectedMarket.oddsUp.toFixed(2)}x odds
            </div>
          </button>

          <button
            className={cn(
              "p-4 rounded-xl transition-all duration-200",
              "bg-gradient-to-br from-red-500/20 to-red-600/10",
              "border-2 border-red-500/30",
              "hover:border-red-500/50 hover:-translate-y-0.5",
              "hover:shadow-[0_0_20px_rgba(255,107,107,0.2)]",
              "group"
            )}
          >
            <div className="text-red-400 font-bold text-lg group-hover:scale-105 transition-transform">
              ▼ Predict DOWN
            </div>
            <div className="text-red-400/70 text-sm mt-1">
              {selectedMarket.oddsDown.toFixed(2)}x odds
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
