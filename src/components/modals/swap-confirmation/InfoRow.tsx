"use client"

import React from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface InfoRowProps {
  label: string
  value: React.ReactNode
  tooltip?: React.ReactNode
  valueClassName?: string
}

// A label/value row used across the swap-confirmation details accordion.
// The emerald highlight on "Minimum received" / "Maximum sold" is intentional
// — these are the slippage-guarantee numbers and deserve the visual emphasis.
export function InfoRow({ label, value, tooltip, valueClassName }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-gray-400">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] bg-[#1c2128] border-white/10">
                <p className="text-xs text-gray-300">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span
        className={cn(
          "text-sm font-medium text-white",
          valueClassName,
          (label === "Minimum received" || label === "Maximum sold") && "text-emerald-400"
        )}
      >
        {value}
      </span>
    </div>
  )
}
