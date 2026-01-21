"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatPriceImpact, getPriceImpactSeverity } from "@/hooks/use-quote"
import { AlertTriangle, ArrowDown, Timer, Zap, ShieldCheck } from "lucide-react"
import type { Token } from "@/types/swap"

interface SwapConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  tokenIn: Token | undefined
  tokenOut: Token | undefined
  amountIn: string
  amountOut: string
  minAmountOut: string
  exchangeRate: number
  priceImpact: number
  slippage: string
  gasEstimate: bigint | null
  ethPrice?: number | null
  timeLeft?: number
  isLoading?: boolean
}

export default function SwapConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  minAmountOut,
  priceImpact,
  slippage,
  gasEstimate,
  ethPrice,
  timeLeft,
  isLoading = false,
}: SwapConfirmationModalProps) {
  const priceImpactSeverity = getPriceImpactSeverity(priceImpact)
  const hasHighPriceImpact = Math.abs(priceImpact) > 3

  const gasEstimateUsd =
    gasEstimate && ethPrice
      ? `$${((Number(gasEstimate) / 1e18) * ethPrice).toFixed(2)}`
      : gasEstimate
        ? `~$${((Number(gasEstimate) / 1e18) * 3000).toFixed(2)}`
        : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] bg-[#0D0D0D] border-white/[0.08] shadow-[0_0_50px_rgba(0,0,0,0.8)] p-0 overflow-hidden gap-0">
        {/* TOP STATUS BAR - Race Aesthetic */}
        <div className="h-1.5 w-full bg-[#1B1B1B] overflow-hidden relative">
          <div
            className={cn(
              "h-full transition-all duration-1000 ease-linear",
              timeLeft && timeLeft <= 5
                ? "bg-red-500 shadow-[0_0_10px_#ef4444]"
                : "bg-emerald-500 shadow-[0_0_10px_#10b981]"
            )}
            style={{ width: `${((timeLeft || 15) / 15) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-emerald-500 fill-emerald-500" />
              <DialogTitle className="text-[13px] font-bold uppercase tracking-[0.25em] text-white/40">
                Transaction Review
              </DialogTitle>
            </div>
            <DialogDescription className="text-lg font-medium text-white">
              Confirm Asset Exchange
            </DialogDescription>
          </DialogHeader>

          {/* ASSET FLOW - Minimalist Performance Look */}
          <div className="relative space-y-1">
            {/* SELL CARD */}
            <div className="group p-4 rounded-2xl bg-[#131313] border border-white/[0.04] flex items-center justify-between transition-colors hover:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-1 rounded-full bg-white/[0.02] border border-white/[0.05]">
                  {tokenIn?.logoURI && (
                    <img
                      src={tokenIn.logoURI}
                      alt={tokenIn.symbol}
                      className="w-7 h-7 rounded-full grayscale-[0.2]"
                    />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                    Pay
                  </span>
                  <span className="text-sm font-semibold text-white tracking-tight">
                    {tokenIn?.symbol}
                  </span>
                </div>
              </div>
              <span className="text-xl font-bold tracking-tighter text-white">{amountIn}</span>
            </div>

            {/* CONNECTION INDICATOR */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[44%] -translate-y-1/2 z-10">
              <div className="p-2 rounded-xl bg-[#0D0D0D] border-4 border-[#0D0D0D] shadow-xl">
                <div className="p-1.5 rounded-lg bg-[#1B1B1B] border border-white/10">
                  <ArrowDown size={14} className="text-emerald-500" />
                </div>
              </div>
            </div>

            {/* BUY CARD */}
            <div className="group p-4 rounded-2xl bg-[#131313] border border-white/[0.04] flex items-center justify-between transition-colors hover:border-white/10 pt-6">
              <div className="flex items-center gap-3">
                <div className="p-1 rounded-full bg-white/[0.02] border border-white/[0.05]">
                  {tokenOut?.logoURI && (
                    <img
                      src={tokenOut.logoURI}
                      alt={tokenOut.symbol}
                      className="w-7 h-7 rounded-full"
                    />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest">
                    Receive
                  </span>
                  <span className="text-sm font-semibold text-white tracking-tight">
                    {tokenOut?.symbol}
                  </span>
                </div>
              </div>
              <span className="text-xl font-bold tracking-tighter text-emerald-500">
                {amountOut}
              </span>
            </div>
          </div>

          {/* TELEMETRY DATA - The "Technical" Section */}
          <div className="grid grid-cols-2 gap-2">
            <TelemetryBox label="Gas Fee" value={gasEstimateUsd} icon={<Zap size={10} />} />
            <TelemetryBox
              label="Slippage"
              value={`${slippage}%`}
              icon={<ShieldCheck size={10} />}
            />
            <TelemetryBox
              label="Price Impact"
              value={formatPriceImpact(priceImpact)}
              color={priceImpactSeverity === "low" ? "text-emerald-400" : "text-red-400"}
            />
            <TelemetryBox label="Route" value="Fast Protocol" />
          </div>

          {/* HIGH IMPACT ALERT */}
          {hasHighPriceImpact && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20 animate-pulse">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-[11px] font-medium text-red-500 leading-tight">
                CRITICAL PRICE IMPACT: You are losing {formatPriceImpact(priceImpact)} on this
                trade.
              </p>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={onConfirm}
              className="w-full h-12 bg-white text-black font-bold uppercase tracking-[0.2em] text-[11px] rounded-xl hover:bg-emerald-500 hover:text-white transition-all duration-300 active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? "Executing..." : "Confirm Intent"}
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors"
            >
              Abandon Transaction
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TelemetryBox({
  label,
  value,
  icon,
  color = "text-white/90",
}: {
  label: string
  value: string
  icon?: React.ReactNode
  color?: string
}) {
  return (
    <div className="flex flex-col p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-white/20">{icon}</span>}
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">
          {label}
        </span>
      </div>
      <span className={cn("text-xs font-mono font-medium", color)}>{value}</span>
    </div>
  )
}
