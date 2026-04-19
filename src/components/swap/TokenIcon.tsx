"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Token } from "@/types/swap"

export function TokenIcon({
  token,
  className,
  size = 40,
  hidden = false,
  bare = false,
}: {
  token: Token | undefined
  className?: string
  size?: number
  hidden?: boolean
  bare?: boolean
}) {
  const [hasImageError, setHasImageError] = useState(false)
  useEffect(() => {
    if (token) setHasImageError(false)
  }, [token?.address])

  if (bare) {
    return token?.logoURI && !hasImageError ? (
      <img
        src={token.logoURI}
        alt={token.symbol}
        className={cn("rounded-full object-contain", className)}
        onError={() => setHasImageError(true)}
      />
    ) : (
      <div className={cn("rounded-full bg-white/10 flex items-center justify-center", className)}>
        <span className="text-xs font-bold text-white uppercase">{token?.symbol?.charAt(0)}</span>
      </div>
    )
  }

  return (
    <div
      className={
        !hidden
          ? cn(
              "rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden p-2.5 min-w-[40px] min-h-[40px]",
              className
            )
          : undefined
      }
    >
      {token?.logoURI && !hasImageError ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          width={size}
          height={size}
          className="h-full w-full object-contain"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span className="text-[10px] font-bold text-white uppercase">
          {token?.symbol?.charAt(0)}
        </span>
      )}
    </div>
  )
}
