"use client"

import { TokenIcon } from "./TokenIcon"
import type { Token } from "@/types/swap"

interface TokenPairIconProps {
  leftToken?: Token
  rightToken?: Token
}

/**
 * Renders two overlapping token icons with clip-path for the overlap effect.
 * Reuses TokenIcon to avoid duplicating token-loading logic.
 * Icons are larger and closer together to match Uniswap-style pairing.
 */
export function TokenPairIcon({ leftToken, rightToken }: TokenPairIconProps) {
  const SIZE = 44
  const OVERLAP = 12

  return (
    <div
      className="relative"
      style={{
        width: SIZE * 2 - OVERLAP,
        height: SIZE,
      }}
    >
      {/* Left token */}
      <div
        className="absolute left-0 top-0"
        style={{
          width: SIZE,
          height: SIZE,
          clipPath: "inset(0 50% 0 0 round 50%)",
        }}
      >
        <TokenIcon token={leftToken} size={SIZE} />
      </div>

      {/* Right token */}
      <div
        className="absolute top-0"
        style={{
          left: SIZE - OVERLAP,
          width: SIZE,
          height: SIZE,
          clipPath: "inset(0 0 0 50% round 50%)",
        }}
      >
        <TokenIcon token={rightToken} size={SIZE} />
      </div>
    </div>
  )
}
