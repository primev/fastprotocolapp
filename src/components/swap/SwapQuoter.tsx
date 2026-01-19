"use client"

import { Timer, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { Quote } from "@/hooks/use-swap-quote"

interface SwapQuoterProps {
  quote: Quote | null
  timeLeft: number
  isRefreshing: boolean
  tokenInSymbol?: string
  tokenOutSymbol?: string
}

export default function SwapQuoter({
  quote,
  timeLeft,
  isRefreshing,
  tokenInSymbol,
  tokenOutSymbol,
}: SwapQuoterProps) {
  return (
    <Card className="p-4 bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-800/50 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-400 text-sm font-medium">Quote Details</span>
        <div
          className={`flex items-center gap-2 text-xs bg-indigo-950/30 px-2 py-1 rounded-full ${
            timeLeft < 5 ? "text-red-400" : "text-indigo-400"
          }`}
        >
          <Timer size={12} className={timeLeft < 5 ? "text-red-400 animate-pulse" : ""} />
          <span className="font-mono">Refreshing in {timeLeft}s</span>
        </div>
      </div>

      {quote ? (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Expected Output</span>
            <span className="text-white font-semibold">
              {quote.output} {tokenOutSymbol || ""}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Price</span>
            <span className="text-gray-300">
              1 {tokenInSymbol || ""} = {quote.price} {tokenOutSymbol || ""}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 italic">
            <span>Relayer Fee (Custom Logic)</span>
            <span>
              {quote.fee} {tokenOutSymbol || ""}
            </span>
          </div>
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center text-gray-600 italic">
          Enter an amount to see a quote...
        </div>
      )}

      {isRefreshing && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
          <RefreshCw size={10} className="animate-spin" />
          Updating Market Price...
        </div>
      )}
    </Card>
  )
}
