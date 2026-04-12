"use client"

import { useState, useEffect, useRef } from "react"
import { Copy, Share2, Check } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface TradeData {
  label: string
  tradeSize: string
  fast: { output: string; improvement: string; time: string; mev: string; blockPosition: string }
  uniswap: { output: string; improvement: string; time: string; mev: string; blockPosition: string }
  oneinch: { output: string; improvement: string; time: string; mev: string; blockPosition: string }
  advantage: string
  advantageAmount: string
}

const trades: TradeData[] = [
  {
    label: "ETH → USDC ($10,000)",
    tradeSize: "$10K",
    fast: {
      output: "$10,041.87",
      improvement: "+0.42%",
      time: "~400 ms",
      mev: "+$11.20",
      blockPosition: "Top-of-block",
    },
    uniswap: {
      output: "$9,998.35",
      improvement: "—",
      time: "~12 sec",
      mev: "$0",
      blockPosition: "Variable",
    },
    oneinch: {
      output: "$10,017.80",
      improvement: "+0.18%",
      time: "~9 sec",
      mev: "$0",
      blockPosition: "Variable",
    },
    advantage: "Net advantage vs Uniswap: +$54.72 on a $10K swap",
    advantageAmount: "+$54.72",
  },
  {
    label: "ETH → USDC ($50,000)",
    tradeSize: "$50K",
    fast: {
      output: "$50,283.17",
      improvement: "+0.57%",
      time: "~380 ms",
      mev: "+$67.15",
      blockPosition: "Top-of-block",
    },
    uniswap: {
      output: "$49,991.20",
      improvement: "—",
      time: "~14 sec",
      mev: "$0",
      blockPosition: "Variable",
    },
    oneinch: {
      output: "$50,108.90",
      improvement: "+0.22%",
      time: "~11 sec",
      mev: "$0",
      blockPosition: "Variable",
    },
    advantage: "Net advantage vs Uniswap: +$359.12 on a $50K swap",
    advantageAmount: "+$359.12",
  },
  {
    label: "WBTC → ETH ($25,000)",
    tradeSize: "$25K",
    fast: {
      output: "8.1437 ETH",
      improvement: "+0.39%",
      time: "~415 ms",
      mev: "+$31.80",
      blockPosition: "Top-of-block",
    },
    uniswap: {
      output: "8.1098 ETH",
      improvement: "—",
      time: "~11 sec",
      mev: "$0",
      blockPosition: "Variable",
    },
    oneinch: {
      output: "8.1251 ETH",
      improvement: "+0.19%",
      time: "~10 sec",
      mev: "$0",
      blockPosition: "Variable",
    },
    advantage: "Net advantage vs Uniswap: +$135.60 on a $25K swap",
    advantageAmount: "+$135.60",
  },
]

const metricLabels = [
  "Output",
  "Value recovered from execution",
  "Time to confirm (execution position advantage)",
  "mev recovered (returned to you)",
  "Block position",
] as const

function getValue(data: TradeData["fast"], metric: (typeof metricLabels)[number]) {
  switch (metric) {
    case "Output":
      return data.output
    case "Value recovered from execution":
      return data.improvement
    case "Time to confirm (execution position advantage)":
      return data.time
    case "mev recovered (returned to you)":
      return data.mev
    case "Block position":
      return data.blockPosition
  }
}

function isPositive(val: string) {
  return val.startsWith("+")
}

function ValueCell({ value, highlight }: { value: string; highlight: boolean }) {
  const ref = useRef<HTMLTableCellElement>(null)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    if (!highlight || !ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true)
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [highlight])

  return (
    <td
      ref={ref}
      className={`text-right px-4 py-3 font-mono font-bold bg-primary/[0.03] ${
        isPositive(value) || value === "Top-of-block" ? "text-success" : "text-foreground"
      } ${animated ? "animate-value-flash" : ""}`}
    >
      {value}
    </td>
  )
}

function TradeCard({ trade }: { trade: TradeData }) {
  const [copied, setCopied] = useState(false)

  const shareText = `I just recovered ${trade.advantageAmount} more using Fast Protocol vs Uniswap on a ${trade.tradeSize} swap. You're leaking value if you're not using this.`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable in non-secure context */
    }
  }

  const handleShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="min-w-[340px] md:min-w-0 bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <span className="font-sora font-semibold text-sm text-foreground">{trade.label}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left px-5 py-3 font-medium">Metric</th>
              <th className="text-right px-4 py-3 font-medium w-[30%] bg-primary/[0.03]">
                <span className="text-primary font-semibold">Fast</span>
              </th>
              <th className="text-right px-4 py-3 font-medium" colSpan={2}>
                <span className="text-muted-foreground/70">Baseline</span>
                <span className="text-muted-foreground/50 ml-1 text-[10px]">
                  (Uniswap / aggregators)
                </span>
              </th>
            </tr>
            <tr className="border-b border-border/50 text-muted-foreground text-[10px]">
              <th></th>
              <th className="bg-primary/[0.03]"></th>
              <th className="text-right px-4 py-1 font-normal">Uniswap</th>
              <th className="text-right px-4 py-1 font-normal">1inch</th>
            </tr>
          </thead>
          <tbody>
            {metricLabels.map((metric) => {
              const fastVal = getValue(trade.fast, metric)
              const uniVal = getValue(trade.uniswap, metric)
              const oneVal = getValue(trade.oneinch, metric)
              const shouldHighlight =
                metric === "mev recovered (returned to you)" ||
                metric === "Output" ||
                metric === "Block position"
              return (
                <tr key={metric} className="border-b border-border/50 last:border-0">
                  <td className="px-5 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      {metric}
                      {metric === "mev recovered (returned to you)" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-muted-foreground/40 text-[9px] text-muted-foreground cursor-help">
                              ?
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">
                            mev is value typically extracted from trades — Fast recovers it and
                            returns it to you.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <ValueCell
                    value={fastVal}
                    highlight={
                      shouldHighlight && (isPositive(fastVal) || fastVal === "Top-of-block")
                    }
                  />
                  <td className="text-right px-4 py-3 font-mono text-muted-foreground">{uniVal}</td>
                  <td className="text-right px-4 py-3 font-mono text-muted-foreground">{oneVal}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 bg-primary/5 border-t border-primary/20 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-primary">{trade.advantage}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="Copy share text"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            type="button"
            aria-label="Share on X"
            onClick={handleShare}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Share2 className="w-3 h-3" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const Comparison = () => {
  const [showAll, setShowAll] = useState(false)
  const visibleTrades = showAll ? trades : trades.slice(0, 2)

  return (
    <section id="comparison" className="px-4 py-20 md:py-28 max-w-6xl mx-auto">
      <h2 className="font-sora font-bold text-2xl sm:text-3xl md:text-4xl text-center mb-3">
        See the difference on real trades
      </h2>

      <p className="text-sm text-muted-foreground/70 text-center mb-2 max-w-lg mx-auto">
        Execution quality depends on where your trade lands in the block — not just routing.
      </p>

      <div className="max-w-xl mx-auto mb-10 mt-6 px-4 py-3 rounded-lg bg-primary/[0.06] border border-primary/10 text-center">
        <p className="text-sm text-foreground/80">
          If your typical swap is ~$10,000, you would have recovered{" "}
          <span className="font-semibold text-success">~$40–$60 more</span> using Fast.
        </p>
      </div>

      <div className="flex md:grid md:grid-cols-2 gap-4 overflow-x-auto pb-4 md:pb-0 snap-x snap-mandatory md:snap-none -mx-4 px-4 md:mx-0 md:px-0">
        {visibleTrades.map((trade) => (
          <div key={trade.label} className="snap-start shrink-0 w-[85vw] md:w-auto">
            <TradeCard trade={trade} />
          </div>
        ))}
      </div>

      {!showAll && (
        <div className="text-center mt-6">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Show more trades ↓
          </button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground/80 mt-8 max-w-xl mx-auto leading-relaxed">
        Based on recent mainnet swaps routed through Fast vs baseline routing (Uniswap /
        aggregators). Results reflect observed execution, not simulations.
      </p>
      <p className="text-center text-[10px] text-muted-foreground/40 mt-2 max-w-md mx-auto">
        Research shows a majority of swaps are impacted by execution ordering.
      </p>
      <p className="text-center text-[10px] text-muted-foreground/40 mt-1 max-w-md mx-auto">
        In extreme cases, execution differences can be significantly larger.
      </p>
    </section>
  )
}

export default Comparison
