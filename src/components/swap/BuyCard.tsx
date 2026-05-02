"use client"

import React from "react"
// UI Components & Icons
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Local Components
import AmountInput from "./AmountInput"
import TokenInfoRow from "./TokenInfoRow"

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
  // the headline buy amount becomes the slippage-adjusted minimum (the new
  // "estimate") so the primary number reflects the swap conditions the user
  // actually agreed to. The pre-calc expected amount is preserved underneath
  // as supporting context so the diff stays visible.
  milesApplied: boolean
  /** Slippage-adjusted minimum receive amount (decimal string). */
  minAmountOut: string | null
  /** Currently effective slippage percent (e.g. 5.4). */
  slippagePct: number
  /** Slippage percent that auto-mode would land at without the miles calc.
   *  Used to compute the "vs standard" delta the user is paying for miles. */
  standardSlippagePct: number
  /** Closes the miles calc, returns slippage to auto, and clears the
   *  miles-applied marker. Surfaced as a "Revert" link next to the
   *  pre-calc estimate so the user has a one-click way back. */
  onRevertMiles: () => void
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
  onRevertMiles,
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

  // Cost-of-miles math: when the calc lifted slippage above the auto baseline,
  // we promote the slippage-adjusted minimum to the headline buy amount and
  // preserve the pre-calc expected amount underneath. Numeric computation only
  // — display strings live in the render block.
  const cleanOutput = outputAmount ? outputAmount.replace(/,/g, "") : ""
  const expectedNum = parseFloat(cleanOutput)
  const cleanMin = minAmountOut ? minAmountOut.replace(/,/g, "") : ""
  const minNum = parseFloat(cleanMin)
  // Only flip the headline when the user is NOT actively typing into the buy
  // input — otherwise we'd overwrite their in-flight value mid-keystroke.
  const showMilesEstimate =
    milesApplied &&
    editingSide !== "buy" &&
    Number.isFinite(expectedNum) &&
    expectedNum > 0 &&
    Number.isFinite(minNum) &&
    minNum > 0 &&
    slippagePct > standardSlippagePct &&
    minNum < expectedNum

  // Compact decimal formatting that mirrors the existing buy-amount precision.
  const formatTokenNum = (n: number): string => {
    if (!Number.isFinite(n)) return "—"
    if (n === 0) return "0"
    if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    if (n >= 0.0001) return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
    return n.toPrecision(2)
  }

  // Headline value the AmountInput renders. When miles are applied, it's the
  // slippage-adjusted min — same formatting precision as the typed amount.
  const headlineValue = showMilesEstimate ? formatTokenNum(minNum) : buyDisplayValue
  const expectedUsd =
    showMilesEstimate && activeToTokenPrice > 0 ? expectedNum * activeToTokenPrice : null

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
            value={toToken ? headlineValue : ""}
            onChange={handleAmountChange}
            onFocus={() => {
              if (editingSide !== "buy") {
                // When swapping into the buy input, seed it with whatever the
                // user is currently looking at — the calc-applied min if it's
                // promoted, otherwise the standard buy display value.
                const seed = (showMilesEstimate ? headlineValue : buyDisplayValue) ?? ""
                const cleanValue = seed.replace(/,/g, "")
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
              {showMilesEstimate ? (
                // Miles applied → headline above is the slippage-adjusted min.
                // The pre-calc estimate stays as a one-line diff with an
                // inline Revert link so the user can back out without hunting
                // for the calc or settings gear.
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm tracking-tight">
                  <span className="whitespace-nowrap tabular-nums text-gray-400">
                    {formatTokenNum(expectedNum)} {toToken.symbol}
                  </span>
                  <button
                    type="button"
                    onClick={onRevertMiles}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors underline-offset-2 hover:underline"
                  >
                    Revert
                  </button>
                </div>
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
