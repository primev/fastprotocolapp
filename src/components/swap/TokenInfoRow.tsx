"use client"

import React, { useRef } from "react"
import NumberFlow from "@number-flow/react"

interface TokenInfoRowProps {
  displayAmount: string
  tokenPrice: number | null
  isLoadingPrice: boolean
  /** When true (quote refetching), keep showing last USD value so the line never disappears. */
  isQuoteLoading?: boolean
  side?: "sell" | "buy"
}

export default React.memo(function TokenInfoRow({
  displayAmount,
  tokenPrice,
  isLoadingPrice,
  isQuoteLoading = false,
  side,
}: TokenInfoRowProps) {
  // Store the last valid USD value in a Ref to persist across re-renders (same as exchange rate: never disappear on refetch)
  const lastValidUsdRef = useRef<number | null>(null)

  // Remove commas from displayAmount before parsing (formatTokenAmount returns values like "3,017.65")
  const cleanDisplayAmount = displayAmount ? displayAmount.replace(/,/g, "") : ""
  const numericDisplayAmount =
    cleanDisplayAmount && !isNaN(parseFloat(cleanDisplayAmount))
      ? parseFloat(cleanDisplayAmount)
      : 0

  // Calculate current value
  const currentUsdValue =
    numericDisplayAmount > 0 && tokenPrice ? numericDisplayAmount * tokenPrice : null

  // Update the buffer when we have a real value. Only clear when user has no amount and no refetch in progress.
  if (currentUsdValue !== null) {
    lastValidUsdRef.current = currentUsdValue
  } else if (
    (numericDisplayAmount === 0 || !displayAmount || displayAmount === "0") &&
    !isLoadingPrice &&
    !isQuoteLoading
  ) {
    lastValidUsdRef.current = null
  }

  // Value to show: current or last valid. During quote refetch (e.g. buy side outputAmount goes to "0"), keep showing last value.
  const valueToDisplay = currentUsdValue ?? lastValidUsdRef.current
  const isEmptyAmount = numericDisplayAmount === 0 || !displayAmount || displayAmount === "0"
  const keepShowingLastDuringRefetch =
    isEmptyAmount && valueToDisplay != null && (isLoadingPrice || isQuoteLoading)

  const renderUsdContent = () => {
    if (isEmptyAmount && !keepShowingLastDuringRefetch) {
      return null
    }
    if (valueToDisplay != null) {
      return (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
          ≈ $
          <NumberFlow
            value={valueToDisplay}
            format={{
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }}
            style={
              {
                "--number-flow-char-gap": "-0.5px",
                "--number-flow-mask-duration": "0.3s",
                "--number-flow-mask-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
                fontVariantNumeric: "tabular-nums",
              } as React.CSSProperties
            }
          />
        </span>
      )
    }
    if (isLoadingPrice) {
      return <span>—</span>
    }
    return <span>—</span>
  }

  return (
    <div className="flex justify-between items-center text-sm font-medium text-gray-500 tracking-tight min-h-[20px]">
      <span className="font-medium">{renderUsdContent()}</span>
    </div>
  )
})
