"use client"

import React from "react"
// UI Components & Icons
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Local Components
import AmountInput from "./AmountInput"
import TokenInfoRow from "./TokenInfoRow"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Hooks
import { useBalanceFlash } from "@/hooks/use-balance-flash"

// Types
import { Token } from "@/types/swap"
import { UseBalanceReturnType } from "wagmi"
import { TokenAvatar } from "@/components/swap/TokenAvatar"

/**
 * Optimized Prop Interface.
 * I have removed props that can be derived or handled locally,
 * focusing only on the "Single Source of Truth" data.
 */
interface BuyCardProps {
  // Token & Value Data (Required for Parent Swap Logic)
  toToken: Token | null
  buyDisplayValue: string
  outputAmount: string
  formattedToBalance: string

  // Blockchain/Balance State (Usually from Wagmi hooks in parent)
  toBalance: UseBalanceReturnType["data"]
  toBalanceValue: number
  isLoadingToBalance: boolean

  // Market Data
  activeToTokenPrice: number
  isLoadingToPrice: boolean
  effectiveQuoteLoading: boolean

  // Identity & Connection
  isConnected: boolean
  address?: string

  // Global UI State Sync
  editingSide: "sell" | "buy"
  setEditingSide: (side: "sell" | "buy") => void
  setAmount: (amount: string) => void
  setIsToTokenSelectorOpen: (open: boolean) => void

  // Input Control
  buyInputRef: React.RefObject<HTMLInputElement>

  // Miles Calc Surface — when the miles calculator was used to apply slippage,
  // we change the header label and replace the USD-price line with a min-out
  // breakdown so the user can see *what they're paying* for the miles they
  // targeted (lower guaranteed receive vs. standard auto slippage).
  milesApplied: boolean
  /** Slippage-adjusted minimum receive amount (decimal string). */
  minAmountOut: string | null
  /** Currently effective slippage percent (e.g. 5.4). */
  slippagePct: number
  /** Slippage percent that auto-mode would land at without the miles calc.
   *  Used to compute the "vs standard" delta the user is paying for miles. */
  standardSlippagePct: number
}

const BuyCardComponent: React.FC<BuyCardProps> = ({
  toToken,
  buyDisplayValue,
  outputAmount,
  formattedToBalance,
  toBalance,
  toBalanceValue,
  isLoadingToBalance,
  activeToTokenPrice,
  isLoadingToPrice,
  effectiveQuoteLoading,
  isConnected,
  address,
  editingSide,
  setEditingSide,
  setAmount,
  setIsToTokenSelectorOpen,
  buyInputRef,
  milesApplied,
  minAmountOut,
  slippagePct,
  standardSlippagePct,
}) => {
  /**
   * 1. LOCAL UI STATE
   * Instead of passing image error handling logic from the parent,
   * we handle it locally. This keeps the parent's logic clean and
   * prevents unnecessary re-renders of the entire swap interface.
   */
  const balanceFlash = useBalanceFlash(toBalanceValue, toToken?.address, isConnected)

  /**
   * 2. EVENT HANDLERS
   * Internalized logic for triggering "buy" side focus when the user
   * interacts with the amount input.
   */
  const handleAmountChange = (value: string) => {
    setEditingSide("buy")
    setAmount(value)
  }

  const handleBalanceClick = () => {
    if (!toToken || toBalanceValue <= 0 || !isConnected) return
    setEditingSide("buy")
    setAmount(toBalanceValue.toString())
  }

  // Cost-of-miles math: the delta between the standard min-out (auto baseline)
  // and the slippage-adjusted min-out the user is now agreeing to. Numeric
  // computation only — no display strings here so the rendering layer stays
  // declarative.
  const cleanOutput = outputAmount ? outputAmount.replace(/,/g, "") : ""
  const expectedNum = parseFloat(cleanOutput)
  const cleanMin = minAmountOut ? minAmountOut.replace(/,/g, "") : ""
  const minNum = parseFloat(cleanMin)
  const showMilesBreakdown =
    milesApplied &&
    Number.isFinite(expectedNum) &&
    expectedNum > 0 &&
    Number.isFinite(minNum) &&
    minNum > 0 &&
    slippagePct > standardSlippagePct
  const standardMin = showMilesBreakdown ? expectedNum * (1 - standardSlippagePct / 100) : null
  const deltaVsStandard = showMilesBreakdown && standardMin != null ? standardMin - minNum : null

  // Compact decimal formatting that mirrors the existing buy-amount precision.
  const formatTokenNum = (n: number): string => {
    if (!Number.isFinite(n)) return "—"
    if (n === 0) return "0"
    if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    if (n >= 0.0001) return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
    return n.toPrecision(2)
  }

  return (
    <div className="rounded-[14px] sm:rounded-[16px] bg-[#161b22] border border-white/5 px-3 py-2.5 sm:px-5 sm:py-4">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
          {milesApplied ? "Buy · miles applied" : "Buy"}
        </span>
        {toToken && (
          <button
            type="button"
            onClick={handleBalanceClick}
            disabled={!isConnected || toBalanceValue <= 0}
            className={cn(
              "text-xs transition-colors duration-700 hover:text-white disabled:hover:text-gray-500 disabled:cursor-default cursor-pointer",
              balanceFlash === "green" ? "text-green-400" : "text-gray-500"
            )}
          >
            Balance: {formattedToBalance}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <AmountInput
            value={toToken ? buyDisplayValue : ""}
            onChange={handleAmountChange}
            onFocus={() => {
              if (editingSide !== "buy") {
                const cleanValue = buyDisplayValue?.replace(/,/g, "") || ""
                if (cleanValue && !isNaN(parseFloat(cleanValue))) {
                  setAmount(cleanValue)
                }
              }
              setEditingSide("buy")
            }}
            onBlur={() => {}}
            isActive={editingSide === "buy"}
            isDisabled={!toToken}
            showError={false}
            isQuoteLoading={effectiveQuoteLoading}
            inputRef={buyInputRef}
          />

          {toToken && !!outputAmount && outputAmount !== "0" && (
            <>
              {showMilesBreakdown && minNum != null && deltaVsStandard != null ? (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-1 flex justify-between items-center text-sm font-medium text-gray-500 tracking-tight min-h-[20px] cursor-help">
                        <span className="font-medium whitespace-nowrap tabular-nums">
                          ≈ $
                          {(minNum * (activeToTokenPrice || 0)).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          {deltaVsStandard > 0 ? ` (−${formatTokenNum(deltaVsStandard)})` : ""}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                      Minimum you&apos;ll receive at the slippage the miles calculator applied. The
                      number in parentheses is what those miles cost you in {toToken.symbol}{" "}
                      compared to standard auto slippage.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <TokenInfoRow
                  displayAmount={outputAmount}
                  tokenPrice={activeToTokenPrice}
                  isLoadingPrice={isLoadingToPrice}
                  isQuoteLoading={effectiveQuoteLoading}
                  side="buy"
                />
              )}
            </>
          )}
        </div>

        {/* Token Selector Button - min-w prevents CLS when token loads */}
        <button
          onClick={() => setIsToTokenSelectorOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold text-sm transition-colors shrink-0 min-w-[120px] justify-between",
            toToken
              ? "bg-white/10 hover:bg-white/15 text-white"
              : "bg-primary hover:bg-primary/90 text-white"
          )}
        >
          {toToken ? (
            <>
              <TokenAvatar token={toToken} size={24} />
              {toToken.symbol}
            </>
          ) : (
            "Select token"
          )}
          <ChevronDown className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  )
}

export const BuyCard = React.memo(BuyCardComponent)
