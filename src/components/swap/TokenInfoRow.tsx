"use client"

import React, { useRef } from "react"

interface TokenInfoRowProps {
  displayAmount: string
  tokenPrice: number | null
  isLoadingPrice: boolean
  side?: "sell" | "buy"
}

export default React.memo(function TokenInfoRow({
  displayAmount,
  tokenPrice,
  isLoadingPrice,
  side,
}: TokenInfoRowProps) {
  // Store the last valid USD value in a Ref to persist across re-renders
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

  // Update the buffer ONLY if we have a real value; clear when no amount so disconnect shows $0
  if (currentUsdValue !== null) {
    lastValidUsdRef.current = currentUsdValue
  } else if (numericDisplayAmount === 0 || !displayAmount || displayAmount === "0") {
    lastValidUsdRef.current = null
  }

  // Determine what to show for USD value
  const getUsdDisplay = () => {
    // When no amount, always show $0 (don't use stale ref from before disconnect)
    if (numericDisplayAmount === 0 || !displayAmount || displayAmount === "0") {
      return "$0"
    }

    // Use the buffer if current is null but we are loading or just switched
    const valueToDisplay = currentUsdValue ?? lastValidUsdRef.current

    if (valueToDisplay) {
      return `≈ $${valueToDisplay.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      })}`
    }

    // If there's an amount but price is loading, show loading indicator
    if (isLoadingPrice) {
      return "—"
    }

    // Default fallback
    return "—"
  }

  return (
    <div className="flex justify-between items-center text-sm font-medium text-white/70 tracking-tight">
      <span className="font-medium">{getUsdDisplay()}</span>
    </div>
  )
})
