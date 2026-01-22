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
  const isSpecialValue = value === "No liquidity"

  const cleanValue = value && !isSpecialValue ? value.replace(/,/g, "") : ""
  const parsedValue = cleanValue && !isNaN(parseFloat(cleanValue)) ? parseFloat(cleanValue) : null
  const numericValue = parsedValue !== null && parsedValue >= 0 ? parsedValue : null

  const decimalPlaces = cleanValue.includes(".") ? cleanValue.split(".")[1]?.length || 0 : 0
  const minFractionDigits = decimalPlaces > 0 ? Math.min(decimalPlaces, 6) : 0

  const fullValue = numericValue > 0 ? numericValue.toString() : null
  const isTrimmed = isActive && fullValue && cleanValue !== fullValue

  const previousValueRef = useRef<number | null>(numericValue)
  const [displayValue, setDisplayValue] = React.useState<number | null>(numericValue)

  const getSmartStartValue = (target: number, previous: number | null): number => {
    if (target === 0) return 0
    if (
      previous !== null &&
      previous > 0 &&
      Math.abs(target - previous) / Math.max(target, previous) < 0.5
    ) {
      return previous
    }

    if (target >= 1000) {
      const magnitude = Math.floor(Math.log10(target))
      const factor = Math.pow(10, Math.max(0, magnitude - 2))
      return Math.floor(target / factor) * factor
    } else if (target >= 100) {
      return Math.floor(target / 10) * 10
    } else if (target >= 10) {
      return Math.floor(target)
    }
    return Math.max(0, target * 0.9)
  }

  useEffect(() => {
    if (!isActive) {
      const prev = previousValueRef.current

      if (numericValue === null) {
        if (value === "0") {
          setDisplayValue(0)
          previousValueRef.current = 0
        }
        return
      }

      const isBigJump =
        ((prev === null || prev === 0) && numericValue > 100) ||
        (prev !== null &&
          prev > 0 &&
          Math.abs(numericValue - prev) / Math.max(numericValue, prev) > 0.5)

      if (isBigJump && numericValue !== prev) {
        const startValue = prev !== null ? getSmartStartValue(numericValue, prev) : numericValue
        setDisplayValue(startValue)
        const timeoutId = setTimeout(() => {
          setDisplayValue(numericValue)
        }, 0)
        return () => clearTimeout(timeoutId)
      } else {
        setDisplayValue(numericValue)
      }

      previousValueRef.current = numericValue
    } else if (isActive) {
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

  const isRefreshing = !isActive && isQuoteLoading && !shouldPulse && !shouldPulseLoop
  const isPulsing = !isActive && (shouldPulse || shouldPulseLoop)

  const inputContent = (
    <div
      className={cn(
        isRefreshing && "transition-all duration-500 ease-in-out",
        isRefreshing
          ? "opacity-10 shadow-none scale-[0.99] filter blur-[1px]"
          : "opacity-100 blur-0 scale-100"
      )}
    >
      {isSpecialValue ? (
        <div className="h-[54px] flex items-center text-[16px] font-bold uppercase tracking-[0.1em] text-white/20 cursor-not-allowed">
          {value}
        </div>
      ) : isActive ? (
        <input
          ref={inputRef}
          type="text"
          value={value || ""}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="0"
          className={cn(
            "h-[54px] bg-transparent text-4xl font-bold outline-none w-full placeholder:text-white/10 leading-none cursor-text caret-white tracking-tighter",
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
            shouldPulse && !shouldPulseLoop && "animate-pulse-3 p-0"
          )}
        >
          {displayValue !== null ? (
            <NumberFlow
              value={displayValue}
              format={{
                minimumFractionDigits: minFractionDigits,
                maximumFractionDigits: 6,
              }}
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
      {isRefreshing && (
        <div className="absolute inset-0 pointer-events-none flex items-center">
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </div>
      )}
    </div>
  )
})
