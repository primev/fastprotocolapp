"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SwapSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slippage: string
  deadline: number
  onSlippageChange: (slippage: string) => void
  onDeadlineChange: (deadline: number) => void
}

const SLIPPAGE_PRESETS = ["0.1", "0.5", "1.0"]
const MIN_SLIPPAGE = 0
const MAX_SLIPPAGE = 50
const MIN_DEADLINE = 5
const MAX_DEADLINE = 1440

export default function SwapSettingsModal({
  open,
  onOpenChange,
  slippage,
  deadline,
  onSlippageChange,
  onDeadlineChange,
}: SwapSettingsModalProps) {
  const [customSlippage, setCustomSlippage] = useState(slippage)
  const [customDeadline, setCustomDeadline] = useState(deadline.toString())
  const [slippageError, setSlippageError] = useState<string | null>(null)
  const [deadlineError, setDeadlineError] = useState<string | null>(null)

  // Sync local state when props change
  useEffect(() => {
    setCustomSlippage(slippage)
    setCustomDeadline(deadline.toString())
  }, [slippage, deadline, open])

  const handleSlippagePreset = (preset: string) => {
    setCustomSlippage(preset)
    setSlippageError(null)
    onSlippageChange(preset)
    // Save to localStorage
    localStorage.setItem("swapSlippage", preset)
  }

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value)
    setSlippageError(null)

    const num = parseFloat(value)
    if (isNaN(num)) {
      setSlippageError("Invalid number")
      return
    }

    if (num < MIN_SLIPPAGE) {
      setSlippageError(`Minimum slippage is ${MIN_SLIPPAGE}%`)
      return
    }

    if (num > MAX_SLIPPAGE) {
      setSlippageError(`Maximum slippage is ${MAX_SLIPPAGE}%`)
      return
    }

    onSlippageChange(value)
    localStorage.setItem("swapSlippage", value)
  }

  const handleDeadlineChange = (value: string) => {
    setCustomDeadline(value)
    setDeadlineError(null)

    const num = parseInt(value, 10)
    if (isNaN(num)) {
      setDeadlineError("Invalid number")
      return
    }

    if (num < MIN_DEADLINE) {
      setDeadlineError(`Minimum deadline is ${MIN_DEADLINE} minutes`)
      return
    }

    if (num > MAX_DEADLINE) {
      setDeadlineError(`Maximum deadline is ${MAX_DEADLINE} minutes`)
      return
    }

    onDeadlineChange(num)
    localStorage.setItem("swapDeadline", num.toString())
  }

  const isPresetActive = (preset: string) => customSlippage === preset

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-[#131313] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Transaction Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            Adjust your transaction settings to control slippage tolerance and deadline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Slippage Tolerance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white">Slippage Tolerance</label>
              <span className="text-xs text-white/60">%</span>
            </div>

            <div className="flex gap-2">
              {SLIPPAGE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={isPresetActive(preset) ? "default" : "outline"}
                  onClick={() => handleSlippagePreset(preset)}
                  className={cn(
                    "flex-1",
                    isPresetActive(preset)
                      ? "bg-primary text-primary-foreground"
                      : "bg-[#1B1B1B] border-white/10 text-white hover:bg-[#222]"
                  )}
                >
                  {preset}%
                </Button>
              ))}
            </div>

            <div className="space-y-1">
              <Input
                type="number"
                step="0.1"
                min={MIN_SLIPPAGE}
                max={MAX_SLIPPAGE}
                value={customSlippage}
                onChange={(e) => handleCustomSlippageChange(e.target.value)}
                placeholder="Custom"
                className={cn(
                  "bg-[#1B1B1B] border-white/10 text-white placeholder:text-white/40",
                  slippageError && "border-destructive"
                )}
              />
              {slippageError && <p className="text-xs text-destructive">{slippageError}</p>}
              {!slippageError && customSlippage && parseFloat(customSlippage) > 5 && (
                <p className="text-xs text-yellow-500">
                  Warning: High slippage tolerance may result in unfavorable rates
                </p>
              )}
            </div>
          </div>

          {/* Transaction Deadline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white">Transaction Deadline</label>
              <span className="text-xs text-white/60">minutes</span>
            </div>

            <div className="space-y-1">
              <Input
                type="number"
                step="1"
                min={MIN_DEADLINE}
                max={MAX_DEADLINE}
                value={customDeadline}
                onChange={(e) => handleDeadlineChange(e.target.value)}
                className={cn(
                  "bg-[#1B1B1B] border-white/10 text-white placeholder:text-white/40",
                  deadlineError && "border-destructive"
                )}
              />
              {deadlineError && <p className="text-xs text-destructive">{deadlineError}</p>}
              {!deadlineError && (
                <p className="text-xs text-white/60">
                  Your transaction will revert if it is pending for more than this period.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
