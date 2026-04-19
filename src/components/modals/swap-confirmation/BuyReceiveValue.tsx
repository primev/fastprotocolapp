"use client"

import NumberFlow from "@number-flow/react"
import { numberFlowStyle } from "./shared"

// Formats a token amount through NumberFlow, preserving the user's decimal
// precision (capped at 6). Falls back to the raw string when the value isn't
// numeric — NumberFlow can't animate "—" or an empty input.
export function BuyReceiveValue({ value, className }: { value: string; className?: string }) {
  const clean = value?.replace(/,/g, "") ?? ""
  const numeric = clean && !Number.isNaN(parseFloat(clean)) ? parseFloat(clean) : null
  const decimalPlaces = clean.includes(".") ? (clean.split(".")[1]?.length ?? 0) : 0
  const minFractionDigits = Math.min(decimalPlaces, 6)
  const maxFractionDigits = Math.max(6, decimalPlaces)

  if (numeric === null) {
    return <span className={className}>{value || "0"}</span>
  }

  return (
    <span className={className}>
      <NumberFlow
        value={numeric}
        format={{
          minimumFractionDigits: minFractionDigits,
          maximumFractionDigits: maxFractionDigits,
          useGrouping: true,
        }}
        style={numberFlowStyle}
      />
    </span>
  )
}
