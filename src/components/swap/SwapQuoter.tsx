"use client"

import { Timer, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
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
    <div className="space-y-1.5 text-xs">
      {quote ? (
        <>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">Expected Output</span>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {quote.output} {tokenOutSymbol || ""}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">Price</span>
            <span className="text-[11px] text-foreground/70 tabular-nums">
              1 {tokenInSymbol || ""} = {quote.price} {tokenOutSymbol || ""}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-border/20">
            <span className="text-[11px] text-muted-foreground">Relayer Fee</span>
            <span className="text-[11px] text-foreground/60 tabular-nums">
              {quote.fee} {tokenOutSymbol || ""}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[11px] text-muted-foreground">Quote expires in</span>
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-mono",
                timeLeft < 5 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <Timer
                size={10}
                className={cn(
                  timeLeft < 5 && "text-destructive animate-pulse"
                )}
              />
              <span className="tabular-nums">{timeLeft}s</span>
            </div>
          </div>
        </>
      ) : (
        <div className="py-1.5 text-center">
          <span className="text-[11px] text-muted-foreground">
            Enter an amount to see a quote...
          </span>
        </div>
      )}

      {isRefreshing && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1.5 border-t border-border/20">
          <RefreshCw size={10} className="animate-spin" />
          <span>Updating...</span>
        </div>
      )}
    </div>
  )
}
