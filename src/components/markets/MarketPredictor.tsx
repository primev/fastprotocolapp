"use client"

import { useMemo } from 'react'
import { useMarketStore } from '@/hooks/useMarketStore'
import { formatTimeLeft, formatPrice, formatChange } from '@/lib/mockMarketData'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Clock, Zap } from 'lucide-react'

interface SparklineProps {
  data: number[]
  isUp: boolean
  width?: number
  height?: number
}

function Sparkline({ data, isUp, width = 400, height = 140 }: SparklineProps) {
  const pathData = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '' }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const padding = 20

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - padding - ((value - min) / range) * (height - padding * 2)
      return { x, y }
    })

    // Create smooth bezier curve
    const linePath = points.reduce((path, point, i, arr) => {
      if (i === 0) return `M ${point.x} ${point.y}`

      // Use bezier curves for smoother lines
      const prev = arr[i - 1]
      const cpx = (prev.x + point.x) / 2
      return `${path} Q ${prev.x + (point.x - prev.x) * 0.5} ${prev.y}, ${point.x} ${point.y}`
    }, '')

    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

    return { linePath, areaPath }
  }, [data, width, height])

  const color = isUp ? '#10b981' : '#f43f5e'
  const gradientId = `sparkline-gradient-${isUp ? 'up' : 'down'}`

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="50%" stopColor={color} stopOpacity="0.1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1="0"
          y1={height * ratio}
          x2={width}
          y2={height * ratio}
          stroke="white"
          strokeOpacity="0.03"
          strokeDasharray="4 4"
        />
      ))}

      {/* Filled area */}
      <path
        d={pathData.areaPath}
        fill={`url(#${gradientId})`}
      />

      {/* Main line */}
      <path
        d={pathData.linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
      />

      {/* Current price dot */}
      {data.length > 0 && (() => {
        const min = Math.min(...data)
        const max = Math.max(...data)
        const range = max - min || 1
        const padding = 20
        const lastY = height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)

        return (
          <g>
            {/* Outer glow */}
            <circle
              cx={width}
              cy={lastY}
              r="8"
              fill={color}
              opacity="0.2"
              className="animate-ping"
            />
            {/* Inner dot */}
            <circle
              cx={width}
              cy={lastY}
              r="5"
              fill={color}
              stroke="#0f1218"
              strokeWidth="2"
            />
          </g>
        )
      })()}
    </svg>
  )
}

export function MarketPredictor() {
  const { selectedMarket } = useMarketStore()

  if (!selectedMarket) {
    return (
      <div className="flex items-center justify-center h-64 rounded-2xl bg-[#0f1218] border border-white/5">
        <p className="text-gray-500">Select a market to view details</p>
      </div>
    )
  }

  const isUp = selectedMarket.changePercent >= 0

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl",
      "bg-gradient-to-br from-[#1a1f2e] via-[#13171f] to-[#0f1218]",
      "border border-white/[0.06]",
      "shadow-2xl shadow-black/20"
    )}>
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Header */}
      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center justify-center w-16 h-16 rounded-2xl text-3xl",
              "bg-gradient-to-br from-white/10 to-white/5",
              "border border-white/10 shadow-lg"
            )}>
              {selectedMarket.icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{selectedMarket.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-400">{selectedMarket.symbol}</span>
                <span className="h-1 w-1 rounded-full bg-gray-600" />
                <span className="flex items-center gap-1.5 text-sm text-gray-400">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  {selectedMarket.type === 'crypto' ? '15min Prediction' : 'Event Market'}
                </span>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className={cn(
            "flex flex-col items-end gap-1 px-4 py-2.5 rounded-xl",
            "bg-white/5 border border-white/5"
          )}>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs uppercase tracking-wider">Ends in</span>
            </div>
            <div className="text-xl font-mono font-bold text-white">
              {formatTimeLeft(selectedMarket.timeLeft)}
            </div>
          </div>
        </div>
      </div>

      {/* Price Display */}
      <div className="relative px-6 py-4 border-y border-white/5 bg-black/20">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Current Price</div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-white tracking-tight">
                {selectedMarket.type === 'crypto' ? '$' : ''}{formatPrice(selectedMarket.currentPrice, selectedMarket.type)}
              </span>
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
                isUp
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-rose-500/15 text-rose-400"
              )}>
                {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="font-semibold">
                  {formatChange(selectedMarket.change, selectedMarket.type)}
                </span>
                <span className="text-sm opacity-70">
                  ({isUp ? '+' : ''}{selectedMarket.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Opening Price</div>
            <div className="text-xl text-gray-400 font-medium">
              {selectedMarket.type === 'crypto' ? '$' : ''}{formatPrice(selectedMarket.openingPrice, selectedMarket.type)}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {selectedMarket.participants.toLocaleString()} participants
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative px-2 py-4">
        <Sparkline
          data={selectedMarket.trend}
          isUp={isUp}
          height={140}
        />
      </div>

      {/* Prediction Buttons */}
      <div className="relative p-6 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <button
            className={cn(
              "group relative overflow-hidden rounded-xl p-5",
              "bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-transparent",
              "border-2 border-emerald-500/30",
              "transition-all duration-300 ease-out",
              "hover:border-emerald-500/50 hover:scale-[1.02] hover:-translate-y-0.5",
              "hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]",
              "active:scale-[0.98]"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center">
              <TrendingUp className="h-8 w-8 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-lg font-bold text-emerald-400">Predict UP</div>
              <div className="text-emerald-400/60 text-sm mt-1">
                {selectedMarket.oddsUp.toFixed(2)}x payout
              </div>
            </div>
          </button>

          <button
            className={cn(
              "group relative overflow-hidden rounded-xl p-5",
              "bg-gradient-to-br from-rose-500/20 via-rose-600/10 to-transparent",
              "border-2 border-rose-500/30",
              "transition-all duration-300 ease-out",
              "hover:border-rose-500/50 hover:scale-[1.02] hover:-translate-y-0.5",
              "hover:shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)]",
              "active:scale-[0.98]"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center">
              <TrendingDown className="h-8 w-8 text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-lg font-bold text-rose-400">Predict DOWN</div>
              <div className="text-rose-400/60 text-sm mt-1">
                {selectedMarket.oddsDown.toFixed(2)}x payout
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
