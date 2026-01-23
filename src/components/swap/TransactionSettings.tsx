"use client"

import React from "react"
// UI Components & Icons
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radix-ui/react-tooltip"
import { Info, Settings } from "lucide-react"

// Utils
import { cn } from "@/lib/utils"

interface TransactionSettingsProps {
  // Popover State
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void

  // Slippage State
  isAutoSlippage: boolean
  handleAutoSlippageChange: (isAuto: boolean) => void
  calculatedAutoSlippage: number
  slippage: string
  handleSlippageChange: (slippage: string) => void

  // Deadline State
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
  const handleDeadlineInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "")
    const newDeadline = value === "" ? 30 : Math.min(Math.max(parseInt(value), 1), 4320)

    setInternalDeadline(newDeadline)
    localStorage.setItem("swapDeadline", newDeadline.toString())
  }

  // Pre-calculate slippage value for warning checks
  const numericSlippage = parseFloat(slippage)

  return (
    <div className="flex items-center justify-between mb-2 sm:mb-3">
      <span className="text-xl font-semibold text-white">Swap</span>

      <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Transaction Settings"
            className="p-2 rounded-lg hover:bg-white/5 transition-colors group"
          >
            <Settings className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-80 bg-[#1c2128] border border-white/10 p-4 rounded-xl shadow-2xl z-50"
        >
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Transaction Settings</h3>

            {/* AUTO SLIPPAGE SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Auto slippage</span>
                <SettingsInfoTooltip text="Automatically adjust slippage based on trade size and market conditions." />
              </div>
              <button
                onClick={() => handleAutoSlippageChange(!isAutoSlippage)}
                className={cn(
                  "w-full py-2 px-3 rounded-lg text-sm font-medium transition-all",
                  isAutoSlippage
                    ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                )}
              >
                {isAutoSlippage ? "Enabled" : "Disabled"}
                {isAutoSlippage && (
                  <span className="ml-2 text-xs opacity-75">
                    ({calculatedAutoSlippage.toFixed(2)}%)
                  </span>
                )}
              </button>
            </div>

            {/* MANUAL SLIPPAGE TOLERANCE SECTION */}
            {!isAutoSlippage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Slippage tolerance</span>
                  <SettingsInfoTooltip text="Your transaction will revert if the price changes unfavorably by more than this percentage." />
                </div>
                <div className="flex gap-2">
                  {["0.1", "0.5", "1.0"].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleSlippageChange(value)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                        slippage === value
                          ? "bg-primary text-white"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {value}%
                    </button>
                  ))}
                </div>

                {/* Validation Warnings */}
                {numericSlippage > 5 && (
                  <p className="text-[11px] text-yellow-500 font-medium">
                    ⚠️ High slippage may result in unfavorable trades
                  </p>
                )}
                {numericSlippage < 0.1 && (
                  <p className="text-[11px] text-yellow-500 font-medium">
                    ⚠️ Low slippage may cause transaction failure
                  </p>
                )}
              </div>
            )}

            {/* TRANSACTION DEADLINE SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Transaction deadline</span>
                <SettingsInfoTooltip text="Your transaction will revert if it remains pending for longer than this period." />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={internalDeadline}
                  onChange={handleDeadlineInputChange}
                  className="w-20 py-2 px-3 rounded-lg text-center text-sm font-bold bg-white/5 border border-white/10 text-white focus:border-primary focus:outline-none transition-colors"
                />
                <span className="text-sm text-gray-400">minutes</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const SettingsInfoTooltip = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help transition-colors" />
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className="max-w-[200px] bg-black border border-white/10 p-2 text-xs text-gray-200 rounded-md shadow-xl"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)
