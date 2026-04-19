import type React from "react"

// NumberFlow animation style shared across the swap-confirmation subtree.
// The char-gap tightens the odometer, and the cubic-bezier gives the mask
// a non-linear ease that matches the rest of the swap UI.
export const numberFlowStyle = {
  "--number-flow-char-gap": "-0.5px",
  "--number-flow-mask-duration": "0.3s",
  "--number-flow-mask-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
  fontVariantNumeric: "tabular-nums",
} as React.CSSProperties
