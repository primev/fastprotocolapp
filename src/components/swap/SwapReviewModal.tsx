"use client"

import { useState } from "react"
import { X, ChevronDown, Info, Fuel } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Token Icons
const ETH_ICON = (
  <svg className="h-full w-full fill-current" viewBox="0 0 320 512">
    <path d="M311.9 260.8L160 353.6 8 260.8 160 0l151.9 260.8zM160 383.4L8 290.6 160 512l152-221.4-152 92.8z" />
  </svg>
)

// TODO: Uncomment when FAST token is available
// const FAST_ICON = (
//   <svg className="h-full w-full" viewBox="0 0 98 95" fill="none">
//     <path
//       d="M0.344727 0.226562L36.7147 94.6165H59.9647L26.0747 0.226562H0.344727Z"
//       className="fill-primary"
//     />
//     <path
//       d="M72.8246 0.226562L52.5447 56.5766H76.2947L97.8146 0.226562H72.8246Z"
//       fill="#E97D25"
//     />
//   </svg>
// )

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
    <text x="16" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
      ?
    </text>
  </svg>
)

interface Token {
  symbol: string
  name: string
  icon: React.ReactNode
}

const TOKENS: Record<string, Token> = {
  ETH: { symbol: "ETH", name: "Ethereum", icon: ETH_ICON },
  // TODO: Uncomment when FAST token is available
  // FAST: { symbol: "FAST", name: "Fast Token", icon: FAST_ICON },
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
  minOut?: string
  priceImpact?: number
  slippage?: string
}

interface InfoRowProps {
  label: string
  value: React.ReactNode
  tooltip?: string
  valueClassName?: string
}

function InfoRow({ label, value, tooltip, valueClassName }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-gray-400">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] bg-[#1c2128] border-white/10">
                <p className="text-xs text-gray-300">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className={cn("text-sm font-medium text-white", valueClassName)}>{value}</span>
    </div>
  )
}

// Format number to max 2 decimal places, removing trailing zeros
function formatAmount(amount: string): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  // For very small numbers, show more precision
  if (num < 0.01 && num > 0) return num.toFixed(6).replace(/\.?0+$/, "")
  // For regular numbers, max 2 decimals
  return num.toFixed(2).replace(/\.?0+$/, "")
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
  minOut,
  priceImpact: priceImpactNum,
  slippage = "0.5",
}: SwapReviewModalProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const fromTokenData = getTokenData(fromToken)
  const toTokenData = getTokenData(toToken)

  // Format amounts for display
  const formattedFromAmount = formatAmount(fromAmount)
  const formattedToAmount = formatAmount(toAmount)
  const formattedMinOut = minOut ? formatAmount(minOut) : formattedToAmount

  // Real values from quote
  const fee = "Free"
  const networkCost = "$0.03"
  const maxSlippage = `${slippage}%`
  const orderRouting = "Fast Protocol"
  const priceImpactDisplay =
    priceImpactNum !== undefined
      ? `${priceImpactNum >= 0 ? "" : "-"}${Math.abs(priceImpactNum).toFixed(2)}%`
      : "-0.01%"
  const priceImpactValue = priceImpactNum ?? -0.01

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="sm:max-w-[500px] p-0 gap-0 bg-[#0d1117] border-white/10 overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-0 relative">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-white">
              Review swap
            </DialogTitle>
            <DialogClose asChild>
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <X className="h-5 w-5 text-gray-400 hover:text-white" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Transaction Summary */}
        <div className="p-5 sm:p-6 space-y-3">
          {/* From Token */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {formattedFromAmount} {fromTokenData.symbol}
              </p>
              <p className="text-sm text-gray-500">{fromUsdValue}</p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center p-2.5">
              {fromTokenData.icon}
            </div>
          </div>

          {/* Arrow Indicator */}
          <div className="flex justify-center py-0.5">
            <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </div>
          </div>

          {/* To Token */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {formattedToAmount} {toTokenData.symbol}
              </p>
              <p className="text-sm text-gray-500">{toUsdValue}</p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center p-2.5">
              {toTokenData.icon}
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="px-5 sm:px-6 py-3 bg-white/[0.02] border-y border-white/5">
          {/* Always visible - collapsed state */}
          <div className="divide-y divide-white/5">
            <InfoRow
              label="Fee"
              value={fee}
              tooltip="The fee charged for this swap"
              valueClassName="text-[#3898FF]"
            />
            <InfoRow
              label="Network cost"
              value={
                <span className="flex items-center gap-1.5">
                  <Fuel className="h-3.5 w-3.5 text-gray-500" />
                  {networkCost}
                </span>
              }
              tooltip="Estimated gas fee for this transaction"
            />
          </div>

          {/* Show more toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-center gap-1.5 w-full py-2 mt-2 rounded-lg hover:bg-white/5 transition-all text-sm text-gray-400 hover:text-white"
          >
            {isExpanded ? "Show less" : "Show more"}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </button>

          {/* Expanded details */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="divide-y divide-white/5 pt-2">
              <InfoRow
                label="Rate"
                value={`1 ${fromTokenData.symbol} = ${exchangeRate.toLocaleString()} ${toTokenData.symbol}`}
                tooltip="Current exchange rate between tokens"
              />
              <InfoRow
                label="Max slippage"
                value={
                  <span className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-medium">
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
                value={priceImpactDisplay}
                tooltip="The difference between market price and estimated price due to trade size"
                valueClassName={
                  priceImpactValue < 0
                    ? "text-green-400"
                    : priceImpactValue > 1
                      ? "text-red-400"
                      : "text-yellow-400"
                }
              />
              {minOut && (
                <InfoRow
                  label="Minimum received"
                  value={`${formattedMinOut} ${toTokenData.symbol}`}
                  tooltip="The minimum amount you will receive after slippage"
                />
              )}
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="p-5 sm:p-6">
          <Button
            onClick={onConfirm}
            disabled={isSwapping}
            className="w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg bg-[#3898FF] hover:bg-[#3898FF]/90 transition-all active:scale-[0.98]"
          >
            {isSwapping ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Swapping...
              </span>
            ) : (
              "Confirm swap"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
