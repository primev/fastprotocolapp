"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Token } from "@/types/swap"

interface CommonTokenButtonsProps {
  tokens: Token[]
  onSelect: (token: Token) => void
}

export default React.memo(function CommonTokenButtons({
  tokens,
  onSelect,
}: CommonTokenButtonsProps) {
  if (tokens.length === 0) return null

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex gap-1.5 transition-opacity duration-200 opacity-0 group-hover/buy:opacity-100">
        {tokens.map((token) => (
          <Tooltip key={token.address}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(token)
                }}
                className="p-1 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
              >
                {token.logoURI ? (
                  <img src={token.logoURI} alt={token.symbol} className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold">{token.symbol[0]}</span>
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{token.symbol}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
})
