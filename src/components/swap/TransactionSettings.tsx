"use client"

import React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover"
import { Info, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TransactionSettingsProps {
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void
  isAutoSlippage: boolean
  handleAutoSlippageChange: (isAuto: boolean) => void
  calculatedAutoSlippage: number
  slippage: string
  handleSlippageChange: (slippage: string) => void
  internalDeadline: number
  setInternalDeadline: (deadline: number) => void
}

export const TransactionSettings: React.FC<TransactionSettingsProps> = ({
  isSettingsOpen,
  setIsSettingsOpen,
  isAutoSlippage,
  handleAutoSlippageChange,
  calculatedAutoSlippage,
  slippage,
  handleSlippageChange,
  internalDeadline,
  setInternalDeadline,
}) => {
  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-xl font-semibold text-white">Swap</span>

      <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
            aria-label="Transaction settings"
          >
            <Settings className="h-5 w-5 text-zinc-400 hover:text-white transition-colors" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[340px] bg-[#0d1117] border border-white/5 p-5 rounded-[24px] shadow-2xl z-50"
        >
          <div className="space-y-6">
            {/* MAX SLIPPAGE ROW */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[15px] font-medium text-zinc-200">Max slippage</span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-zinc-500 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[200px] bg-[#161b22] border-white/10"
                    >
                      <p className="text-xs text-gray-300">
                        Maximum price movement allowed before transaction reverts
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center border border-white/10 rounded-full px-3 py-1.5 min-w-[140px] justify-between bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => handleAutoSlippageChange(!isAutoSlippage)}
                  className={cn(
                    "text-[13px] font-bold px-3 py-0.5 rounded-full transition-colors",
                    isAutoSlippage
                      ? "bg-primary/10 text-primary"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Auto
                </button>

                <div className="flex items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={isAutoSlippage ? calculatedAutoSlippage.toFixed(2) : slippage}
                    disabled={isAutoSlippage}
                    onChange={(e) => handleSlippageChange(e.target.value.replace(/[^0-9.]/g, ""))}
                    className={cn(
                      "w-12 bg-transparent text-right text-[15px] font-medium outline-none focus:ring-0",
                      isAutoSlippage ? "text-zinc-400" : "text-white"
                    )}
                  />
                  <span className="text-[15px] text-zinc-500 ml-0.5 font-medium">%</span>
                </div>
              </div>
            </div>

            {/* SWAP DEADLINE ROW */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[15px] font-medium text-zinc-200">Swap deadline</span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-zinc-500 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[200px] bg-[#161b22] border-white/10"
                    >
                      <p className="text-xs text-gray-300">
                        Transaction will revert if not confirmed within this time
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center bg-[#161b22] border border-white/5 rounded-full px-4 py-2 min-w-[140px] justify-center gap-2">
                <input
                  type="text"
                  value={internalDeadline}
                  onChange={(e) => setInternalDeadline(Number(e.target.value.replace(/\D/g, "")))}
                  className="w-8 bg-transparent text-center text-[15px] text-white font-medium outline-none focus:ring-0"
                />
                <span className="text-[15px] text-zinc-500 font-medium">minutes</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
