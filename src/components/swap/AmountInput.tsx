"use client"

import React from "react"
import { cn } from "@/lib/utils"
import NumberFlow from "@number-flow/react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  onFocus: () => void
  onBlur: () => void
  isActive: boolean
  isDisabled: boolean
  showError: boolean
  shouldPulse: boolean
  shouldPulseLoop: boolean
  isQuoteLoading?: boolean
  pulseAnimationKey: number
  inputRef?: React.RefObject<HTMLInputElement>
}

export default React.memo(function AmountInput({
  value,
  onChange,
  onFocus,
  onBlur,
  isActive,
  isDisabled,
  showError,
  shouldPulse,
  shouldPulseLoop,
  isQuoteLoading,
  pulseAnimationKey,
  inputRef,
}: AmountInputProps) {
  const fullValue = value && parseFloat(value) > 0 ? parseFloat(value).toString() : null
  const isTrimmed = isActive && fullValue && value !== fullValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/[^0-9.]/g, "")
    const parts = inputValue.split(".")
    const cleaned = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : inputValue
    onChange(cleaned)
  }

  if (isTrimmed) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-1 relative">
              {isActive ? (
                <input
                  ref={inputRef}
                  key={`input-tooltip-${pulseAnimationKey}`}
                  type="text"
                  value={value}
                  onChange={handleChange}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  placeholder="0"
                  className={cn(
                    "bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none cursor-text caret-white",
                    showError && "text-destructive"
                  )}
                  disabled={isDisabled}
                />
              ) : (
                <div
                  className={cn(
                    "text-4xl font-medium leading-none cursor-text",
                    !isActive && isQuoteLoading && "animate-pulse-3-loop"
                  )}
                >
                  <NumberFlow
                    value={parseFloat(value) || 0}
                    format={{ minimumFractionDigits: 0, maximumFractionDigits: 6 }}
                    spinTiming={{ duration: 600, easing: "ease-out" }}
                  />
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs font-mono bg-zinc-900 border-zinc-700">
            <p className="text-white/70">
              {parseFloat(value).toLocaleString("en-US", {
                maximumFractionDigits: 18,
                useGrouping: false,
              })}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex-1 relative">
      {isActive ? (
        <input
          ref={inputRef}
          key={`input-simple-${pulseAnimationKey}`}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="0"
          className={cn(
            "bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20 leading-none cursor-text caret-white",
            showError && "text-destructive",
            !isActive && shouldPulseLoop && "animate-pulse-3-loop",
            !isActive && shouldPulse && !shouldPulseLoop && "animate-pulse-3"
          )}
          disabled={isDisabled}
        />
      ) : (
        <div
          className={cn(
            "text-4xl font-medium leading-none cursor-text",
            !isActive && shouldPulseLoop && "animate-pulse-3-loop",
            !isActive && shouldPulse && !shouldPulseLoop && "animate-pulse-3"
          )}
        >
          <NumberFlow
            value={parseFloat(value) || 0}
            format={{ minimumFractionDigits: 0, maximumFractionDigits: 6 }}
            spinTiming={{ duration: 600, easing: "ease-out" }}
          />
        </div>
      )}
    </div>
  )
})
