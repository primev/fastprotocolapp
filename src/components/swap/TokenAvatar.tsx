"use client"

import React, { useMemo, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { Token } from "@/types/swap"
import { tokenIconCandidates } from "@/lib/tokens/token-icons"
import { resolveImageUrl } from "@/lib/utils"

interface TokenAvatarProps {
  token: Pick<Token, "address" | "symbol" | "logoURI">
  /** Pixel size for the rendered image + circular frame. */
  size: number
  /** Optional className applied to the outer frame. */
  className?: string
}

/**
 * Renders a token's icon with a progressive fallback chain. Walks the list
 * returned by tokenIconCandidates() in order — each time the image errors,
 * we advance to the next candidate. When all candidates are exhausted we
 * render a text avatar (first letter of the symbol).
 *
 * Curated Uniswap tokens short-circuit to a single authoritative URL, so
 * this component's fallback chain only runs for long-tail barter tokens.
 */
export const TokenAvatar = React.memo(function TokenAvatar({
  token,
  size,
  className,
}: TokenAvatarProps) {
  const candidates = useMemo(() => tokenIconCandidates(token), [token])
  const [index, setIndex] = useState(0)

  // Reset the walker whenever the token identity changes (candidates memo
  // returns a new array reference on token change).
  const prevCandidatesRef = React.useRef(candidates)
  if (prevCandidatesRef.current !== candidates) {
    prevCandidatesRef.current = candidates

    if (index !== 0) setIndex(0)
  }

  const exhausted = index >= candidates.length
  const currentUrl = exhausted ? null : candidates[index]

  const fontSize = Math.max(10, Math.round(size / 3))
  const frameClass = cn(
    "flex items-center justify-center overflow-hidden rounded-full shrink-0",
    className
  )

  if (!currentUrl) {
    return (
      <div
        className={frameClass}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <div
          className="h-full w-full flex items-center justify-center bg-gray-600 font-bold text-white uppercase"
          style={{ fontSize }}
        >
          {token.symbol.charAt(0)}
        </div>
      </div>
    )
  }

  return (
    <div
      className={frameClass}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      <Image
        src={resolveImageUrl(currentUrl)}
        alt={token.symbol}
        width={size}
        height={size}
        className="h-full w-full object-contain"
        onError={() => setIndex((i) => i + 1)}
        loading="lazy"
        unoptimized
      />
    </div>
  )
})
