"use client"

import { TokenIcon } from "./TokenIcon"
import type { Token } from "@/types/swap"

interface TokenPairIconProps {
  leftToken?: Token
  rightToken?: Token
}

/**
 * Renders two halves of token icons with a slight vertical gap in the center.
 * Shadows are removed to keep the interface flat and clean.
 */
export function TokenPairIcon({ leftToken, rightToken }: TokenPairIconProps) {
  // Maintaining the requested size
  const SIZE = 44
  // This percentage defines how much of the center is "cut away" to create the gap
  const GAP_OFFSET = 2

  return (
    <div
      className="relative overflow-hidden rounded-full shadow-none"
      style={{
        width: SIZE,
        height: SIZE,
      }}
    >
      {/* Left half: Clipped slightly before the center line */}
      <div
        className="absolute inset-0 shadow-none"
        style={{
          clipPath: `inset(0 ${50 + GAP_OFFSET}% 0 0)`,
        }}
      >
        <TokenIcon token={leftToken} size={SIZE} hidden={true} />
      </div>

      {/* Right half: Clipped slightly after the center line */}
      <div
        className="absolute inset-0 shadow-none"
        style={{
          clipPath: `inset(0 0 0 ${50 + GAP_OFFSET}%)`,
        }}
      >
        <TokenIcon token={rightToken} size={SIZE} hidden={true} />
      </div>
    </div>
  )
}
