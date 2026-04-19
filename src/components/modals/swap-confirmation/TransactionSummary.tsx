"use client"

import NumberFlow from "@number-flow/react"
import { ChevronDown } from "lucide-react"
import type { Token } from "@/types/swap"
import { TokenIcon } from "@/components/swap/TokenIcon"
import { BuyReceiveValue } from "./BuyReceiveValue"
import { numberFlowStyle } from "./shared"

export interface TransactionSummaryProps {
  tokenIn: Token | undefined
  tokenOut: Token | undefined
  amountIn: string
  amountOut: string
  /** Pre-computed from amountIn * fromTokenPrice. `null` means "no USD quote". */
  fromUsdValue: number | null
  /** Pre-computed from amountOut * toTokenPrice. `null` means "no USD quote". */
  toUsdValue: number | null
}

// From / To summary at the top of the confirmation modal. USD values are
// pre-computed in the parent so we don't re-do the multiplication here (and
// the NaN / null-guard logic only lives in one place).
export function TransactionSummary({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  fromUsdValue,
  toUsdValue,
}: TransactionSummaryProps) {
  return (
    <div className=" px-5 pb-6 space-y-3">
      {/* From Token */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-2xl sm:text-3xl font-bold text-white">
            <BuyReceiveValue value={amountIn} className="tabular-nums" /> {tokenIn?.symbol}
          </p>
          <p className="text-sm text-gray-500 tabular-nums">
            {fromUsdValue != null ? (
              <span className="inline-flex items-center gap-0.5">
                ≈ $
                <NumberFlow
                  value={fromUsdValue}
                  format={{
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: true,
                  }}
                  style={numberFlowStyle}
                />
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>
        <TokenIcon token={tokenIn} bare className="h-11 w-11 sm:h-12 sm:w-12" />
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
            <BuyReceiveValue value={amountOut} className="tabular-nums" /> {tokenOut?.symbol}
          </p>
          <p className="text-sm text-gray-500 tabular-nums">
            {toUsdValue != null ? (
              <span className="inline-flex items-center gap-0.5">
                ≈ $
                <NumberFlow
                  value={toUsdValue}
                  format={{
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: true,
                  }}
                  style={numberFlowStyle}
                />
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>
        <TokenIcon token={tokenOut} bare className="h-11 w-11 sm:h-12 sm:w-12" />
      </div>
    </div>
  )
}
