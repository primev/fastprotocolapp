"use client"

import React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Token } from "@/types/swap"

interface TokenSelectButtonProps {
  token: Token | undefined
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}

function TokenSelectButton({ token, onClick }: TokenSelectButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center rounded-full transition-all",
        token
          ? "gap-2 bg-[#131313] hover:bg-[#222] border border-white/10 pl-1 pr-3 py-1 shadow-sm"
          : "gap-1.5 bg-primary hover:opacity-90 text-primary-foreground px-3 py-1.5 shadow-lg"
      )}
    >
      {token ? (
        <>
          {token.logoURI ? (
            <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center">
              <img
                src={token.logoURI}
                alt={token.symbol}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
              <span className="text-xs font-bold">{token.symbol[0]}</span>
            </div>
          )}
          <span className="font-bold text-lg">{token.symbol}</span>
        </>
      ) : (
        <span className="font-bold text-sm">Select token</span>
      )}
      <ChevronDown size={token ? 16 : 14} className={token ? "text-white/40" : ""} />
    </button>
  )
}

export default React.memo(TokenSelectButton)
