"use client"

import { useState } from "react"
import { X, Settings, ChevronDown, ChevronUp, Info, Fuel } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Token Icons
const ETH_ICON = (
  <svg className="h-full w-full fill-current" viewBox="0 0 320 512">
    <path d="M311.9 260.8L160 353.6 8 260.8 160 0l151.9 260.8zM160 383.4L8 290.6 160 512l152-221.4-152 92.8z" />
  </svg>
)

const FAST_ICON = (
  <svg className="h-full w-full" viewBox="0 0 98 95" fill="none">
    <path
      d="M0.344727 0.226562L36.7147 94.6165H59.9647L26.0747 0.226562H0.344727Z"
      className="fill-primary"
    />
    <path
      d="M72.8246 0.226562L52.5447 56.5766H76.2947L97.8146 0.226562H72.8246Z"
      fill="#E97D25"
    />
  </svg>
)

const USDC_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#2775CA" />
    <path
      d="M20.5 18.5c0-2-1.5-2.75-4.5-3.25-2-.5-2.5-1-2.5-2s1-1.75 2.5-1.75c1.5 0 2.25.5 2.5 1.5h2c-.25-1.75-1.5-3-3.5-3.25V8h-2v1.75c-2 .25-3.5 1.5-3.5 3.5 0 2 1.5 2.75 4.5 3.25 2 .5 2.5 1 2.5 2s-1 1.75-2.5 1.75c-1.75 0-2.5-.75-2.75-1.75h-2c.25 2 1.75 3.25 3.75 3.5V24h2v-1.75c2-.25 3.5-1.5 3.5-3.75z"
      fill="white"
    />
  </svg>
)

const DEFAULT_ICON = (
  <svg className="h-full w-full" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#6B7280" />
    <text x="16" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">?</text>
  </svg>
)

interface Token {
  symbol: string
  name: string
  icon: React.ReactNode
}

const TOKENS: Record<string, Token> = {
  ETH: { symbol: "ETH", name: "Ethereum", icon: ETH_ICON },
  FAST: { symbol: "FAST", name: "Fast Token", icon: FAST_ICON },
  USDC: { symbol: "USDC", name: "USD Coin", icon: USDC_ICON },
}

function getTokenData(token: string): Token {
  return TOKENS[token] || { symbol: token, name: "Custom Token", icon: DEFAULT_ICON }
}

interface SwapReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  fromUsdValue: string
  toUsdValue: string
  exchangeRate: number
  onConfirm: () => void
  isSwapping?: boolean
}

interface InfoRowProps {
  label: string
  value: React.ReactNode
  tooltip?: string
  valueClassName?: string
}

function InfoRow({ label, value, tooltip, valueClassName }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 sm:py-3">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className={cn("text-sm font-medium", valueClassName)}>{value}</span>
    </div>
  )
}

export function SwapReviewModal({
  open,
  onOpenChange,
  fromToken,
  toToken,
  fromAmount,
  toAmount,
  fromUsdValue,
  toUsdValue,
  exchangeRate,
  onConfirm,
  isSwapping = false,
}: SwapReviewModalProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const fromTokenData = getTokenData(fromToken)
  const toTokenData = getTokenData(toToken)

  // Mock values - in production these would come from actual calculations
  const fee = "Free"
  const networkCost = "$0.03"
  const maxSlippage = "0.50%"
  const orderRouting = "Fast Protocol"
  const priceImpact = "-0.02%"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 bg-card border-border/50 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-0 relative">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl sm:text-2xl font-bold">
              Lightning-fast swaps
            </DialogTitle>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Swap settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DialogClose asChild>
                <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <X className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                </button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        {/* Transaction Summary */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* From Token */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-bold">
                {fromAmount} {fromTokenData.symbol}
              </p>
              <p className="text-sm sm:text-base text-muted-foreground">
                {fromUsdValue}
              </p>
            </div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-muted/50 border border-border/50 flex items-center justify-center p-2.5 sm:p-3">
              {fromTokenData.icon}
            </div>
          </div>

          {/* Arrow Indicator */}
          <div className="flex justify-center py-1">
            <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center">
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {/* To Token */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-bold">
                {toAmount} {toTokenData.symbol}
              </p>
              <p className="text-sm sm:text-base text-muted-foreground">
                {toUsdValue}
              </p>
            </div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-muted/50 border border-border/50 flex items-center justify-center p-2.5 sm:p-3">
              {toTokenData.icon}
            </div>
          </div>
        </div>

        {/* Divider with Toggle */}
        <div className="px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/50" />
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 hover:bg-muted/30 transition-all text-sm text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? "Show less" : "Show more"}
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isExpanded && "rotate-180"
                )}
              />
            </button>
            <div className="flex-1 h-px bg-border/50" />
          </div>
        </div>

        {/* Details Section */}
        <div className="px-4 sm:px-6">
          {/* Always visible - collapsed state */}
          <div className="divide-y divide-border/30">
            <InfoRow
              label="Fee"
              value={fee}
              tooltip="The fee charged for this swap"
              valueClassName="text-primary"
            />
            <InfoRow
              label="Network cost"
              value={
                <span className="flex items-center gap-1.5">
                  <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                  {networkCost}
                </span>
              }
              tooltip="Estimated gas fee for this transaction"
            />
          </div>

          {/* Expanded details */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="divide-y divide-border/30 pt-0">
              <InfoRow
                label="Rate"
                value={`1 ${fromTokenData.symbol} = ${exchangeRate.toLocaleString()} ${toTokenData.symbol}`}
                tooltip="Current exchange rate between tokens"
              />
              <InfoRow
                label="Max slippage"
                value={
                  <span className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-muted/50 text-xs font-medium">
                      Auto
                    </span>
                    {maxSlippage}
                  </span>
                }
                tooltip="Maximum price movement allowed before transaction reverts"
              />
              <InfoRow
                label="Order routing"
                value={orderRouting}
                tooltip="Protocol used to execute this swap"
              />
              <InfoRow
                label="Price impact"
                value={priceImpact}
                tooltip="The difference between market price and estimated price due to trade size"
                valueClassName={
                  parseFloat(priceImpact) < 0
                    ? "text-green-500"
                    : "text-red-500"
                }
              />
            </div>
          </div>
        </div>

        {/* Warning Banner (optional - for high slippage, etc.) */}
        {/*
        <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-sm text-yellow-500 text-center">
            High price impact. Consider reducing your trade size.
          </p>
        </div>
        */}

        {/* CTA Button */}
        <div className="p-4 sm:p-6 pt-4">
          <Button
            onClick={onConfirm}
            disabled={isSwapping}
            className="w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            {isSwapping ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Swapping...
              </span>
            ) : (
              "Swap"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
