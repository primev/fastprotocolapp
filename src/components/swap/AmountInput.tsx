"use client"

import React, { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import NumberFlow from "@number-flow/react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AmountInputProps {
  value: string | null
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
  // Remove commas and other formatting from value for parsing
  // formatTokenAmount returns values like "3,016.86" which parseFloat can't handle
  // If value is null, preserve previous display value to avoid showing "0"
  const cleanValue = value ? value.replace(/,/g, "") : ""
  const parsedValue = cleanValue && !isNaN(parseFloat(cleanValue)) ? parseFloat(cleanValue) : null
  const numericValue = parsedValue !== null && parsedValue >= 0 ? parsedValue : null

  // Preserve decimal precision from original value to maintain trailing zeros (e.g., 13.50)
  const decimalPlaces = cleanValue.includes(".") ? cleanValue.split(".")[1]?.length || 0 : 0
  const minFractionDigits = decimalPlaces > 0 ? Math.min(decimalPlaces, 6) : 0

  const fullValue = numericValue > 0 ? numericValue.toString() : null
  const isTrimmed = isActive && fullValue && cleanValue !== fullValue

  // Track previous value and manage display value for smart starting point
  // Preserve previous value when new value is null to avoid showing "0"
  const previousValueRef = useRef<number | null>(numericValue)
  const [displayValue, setDisplayValue] = React.useState<number | null>(numericValue)

  // Calculate a smart starting value that's close to the target
  // For big numbers, round down to nearest significant digit to avoid spinning from 0
  const getSmartStartValue = (target: number, previous: number | null): number => {
    if (target === 0) return 0
    if (
      previous !== null &&
      previous > 0 &&
      Math.abs(target - previous) / Math.max(target, previous) < 0.5
    ) {
      // If change is less than 50%, use previous value
      return previous
    }

    // For large numbers, round down to nearest significant digit
    if (target >= 1000) {
      const magnitude = Math.floor(Math.log10(target))
      const factor = Math.pow(10, Math.max(0, magnitude - 2)) // Round to nearest 100th
      return Math.floor(target / factor) * factor
    } else if (target >= 100) {
      return Math.floor(target / 10) * 10 // Round to nearest 10
    } else if (target >= 10) {
      return Math.floor(target) // Round to nearest 1
    }
    return Math.max(0, target * 0.9) // Start at 90% for small numbers
  }

  // Update display value with smart starting point for big jumps
  useEffect(() => {
    if (!isActive) {
      const prev = previousValueRef.current

      // If new value is null, preserve previous display value to avoid showing "0"
      if (numericValue === null) {
        // Keep previous display value, don't update
        return
      }

      const isBigJump =
        ((prev === null || prev === 0) && numericValue > 100) ||
        (prev !== null &&
          prev > 0 &&
          Math.abs(numericValue - prev) / Math.max(numericValue, prev) > 0.5)

      if (isBigJump && numericValue !== prev) {
        const startValue = prev !== null ? getSmartStartValue(numericValue, prev) : numericValue
        // Set to start value first, then animate to target
        setDisplayValue(startValue)
        const timeoutId = setTimeout(() => {
          setDisplayValue(numericValue)
        }, 0) // Use setTimeout(0) to ensure it happens on next tick
        return () => clearTimeout(timeoutId)
      } else {
        // Small changes, animate directly from previous
        setDisplayValue(numericValue)
      }

      previousValueRef.current = numericValue
    } else if (isActive) {
      // When user is typing, update immediately (even if null, to clear input)
      setDisplayValue(numericValue)
      previousValueRef.current = numericValue
    }
  }, [numericValue, isActive])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/[^0-9.]/g, "")
    const parts = inputValue.split(".")
    const cleaned = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : inputValue
    onChange(cleaned)
  }

  // ELEGANT REFRESH STATE:
  // We want to distinguish between "User is typing" and "System is calculating"
  // If the user isn't active and the quote is loading, we apply the "Racey Fade"
  // But only if we're not pulsing (pulse takes precedence for quote updates)
  const isRefreshing = !isActive && isQuoteLoading && !shouldPulse && !shouldPulseLoop
  const isPulsing = !isActive && (shouldPulse || shouldPulseLoop)

  const inputContent = (
    <div
      className={cn(
        // Only apply transition when refreshing (not when pulsing, to avoid interference)
        isRefreshing && "transition-all duration-500 ease-in-out",
        // The "Fade to Black" logic:
        // We drop opacity significantly and add a slight blur/scale
        // to make the value look like it's "receding" into the background
        // Only apply when refreshing (token change) and not pulsing (quote update)
        isRefreshing
          ? "opacity-10 shadow-none scale-[0.99] filter blur-[1px]"
          : "opacity-100 blur-0 scale-100"
      )}
    >
      {isActive ? (
        <input
          ref={inputRef}
          type="text"
          value={value || ""}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="0"
          className={cn(
            "bg-transparent text-4xl font-bold outline-none w-full placeholder:text-white/10 leading-none cursor-text caret-white tracking-tighter",
            showError && "text-red-500"
          )}
          disabled={isDisabled}
        />
      ) : (
        <div
          key={pulseAnimationKey}
          className={cn(
            "text-4xl font-bold leading-none cursor-default tracking-tighter text-white",
            shouldPulseLoop && "animate-pulse-3-loop",
            shouldPulse && !shouldPulseLoop && "animate-pulse-3"
          )}
        >
          {displayValue !== null ? (
            <NumberFlow
              value={displayValue}
              format={{
                minimumFractionDigits: minFractionDigits,
                maximumFractionDigits: 6,
              }}
              // Fast timing for a "mechanical" feel
              spinTiming={{ duration: 400, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }}
              opacityTiming={{ duration: 200 }}
            />
          ) : (
            <span className="opacity-0">0</span>
          )}
        </div>
      )}
    </div>
  )

  if (isTrimmed) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-1 relative">
              {inputContent}
              {/* SHIMMER OVERLAY: Optional "racey" detail */}
              {isRefreshing && (
                <div className="absolute inset-0 pointer-events-none flex items-center">
                  <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs font-mono bg-zinc-900 border-zinc-700">
            <p className="text-white/70">
              {numericValue?.toLocaleString("en-US", {
                maximumFractionDigits: 18,
                useGrouping: false,
              }) || "0"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex-1 relative">
      {inputContent}
      {/* SHIMMER OVERLAY: Optional "racey" detail */}
      {isRefreshing && (
        <div className="absolute inset-0 pointer-events-none flex items-center">
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </div>
      )}
    </div>
  )
})
