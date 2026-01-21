"use client"

import { Settings } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface SwapSettingsProps {
  slippage: string
  deadline: number
  onSlippageChange: (slippage: string) => void
  onDeadlineChange: (deadline: number) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function SwapSettings({
  slippage,
  deadline,
  onSlippageChange,
  onDeadlineChange,
  isOpen,
  onOpenChange,
}: SwapSettingsProps) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-2 rounded-full transition-transform duration-300 ease-in-out",
            "text-white/60",
            "hover:rotate-90",
            "focus:outline-none",
            isOpen && "rotate-90"
          )}
        >
          <Settings size={18} strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[320px] p-4 bg-[#131313] border border-white/10 rounded-lg shadow-xl"
        sideOffset={8}
        onPointerDownOutside={(e) => {
          // Close when clicking outside, but not when clicking the trigger button
          const target = e.target as HTMLElement
          const triggerButton = target.closest("button")
          if (triggerButton && triggerButton.querySelector("svg")) {
            // This is the settings button, let Popover handle it
            return
          }
          onOpenChange(false)
        }}
      >
        <div className="space-y-4">
          {/* Slippage Tolerance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white">Slippage Tolerance</label>
              <span className="text-xs text-white/60">%</span>
            </div>
            <div className="flex gap-2">
              {["0.1", "0.5", "1.0"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    onSlippageChange(preset)
                    localStorage.setItem("swapSlippage", preset)
                  }}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    slippage === preset
                      ? "bg-primary text-primary-foreground"
                      : "bg-[#1B1B1B] border border-white/10 text-white hover:bg-[#222]"
                  )}
                >
                  {preset}%
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.1"
              min="0"
              max="50"
              value={slippage}
              onChange={(e) => {
                const value = e.target.value
                const num = parseFloat(value)
                if (!isNaN(num) && num >= 0 && num <= 50) {
                  onSlippageChange(value)
                  localStorage.setItem("swapSlippage", value)
                }
              }}
              placeholder="Custom"
              className="w-full px-3 py-1.5 text-xs bg-[#1B1B1B] border border-white/10 rounded-md text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Transaction Deadline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white">Transaction Deadline</label>
              <span className="text-xs text-white/60">minutes</span>
            </div>
            <input
              type="number"
              step="1"
              min="5"
              max="1440"
              value={deadline}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10)
                if (!isNaN(value) && value >= 5 && value <= 1440) {
                  onDeadlineChange(value)
                  localStorage.setItem("swapDeadline", value.toString())
                }
              }}
              className="w-full px-3 py-1.5 text-xs bg-[#1B1B1B] border border-white/10 rounded-md text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-white/60">
              Transaction will revert if pending longer than this period.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
