"use client"

import React, { useRef, useEffect, useLayoutEffect, useState } from "react"
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
  isQuoteLoading?: boolean
  inputRef?: React.RefObject<HTMLInputElement>
  // Pulse props are accepted but intentionally ignored to ensure input never pulses
  shouldPulse?: boolean
  shouldPulseLoop?: boolean
  pulseAnimationKey?: number
}

export default function AmountInput({
  value,
  onChange,
  onFocus,
  onBlur,
  isActive,
  isDisabled,
  showError,
  isQuoteLoading,
  inputRef,
  // Pulse props are accepted but intentionally ignored
  shouldPulse: _shouldPulse,
  shouldPulseLoop: _shouldPulseLoop,
  pulseAnimationKey: _pulseAnimationKey,
}: AmountInputProps) {
  // Debug showError prop
  React.useEffect(() => {
    if (showError) {
      console.log("AmountInput: showError is true, isActive:", isActive)
    }
  }, [showError, isActive])
  const isSpecialValue = value === "No liquidity"
  const cleanValue = value && !isSpecialValue ? value.replace(/,/g, "") : ""

  const [fontPx, setFontPx] = useState(36)
  const containerRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLSpanElement>(null)

  // 1. DYNAMIC FONT CALCULATION WITH SAFETY GUTTER
  useLayoutEffect(() => {
    const container = containerRef.current
    const mirror = mirrorRef.current
    if (!container || !mirror) return

    const MAX_FONT_SIZE = 36
    const MIN_FONT_SIZE = 14
    const RIGHT_GUTTER = 4 // Pixels to reserve to prevent clipping

    const adjustSize = () => {
      // Use clientWidth to exclude potential scrollbar widths
      const availableWidth = container.clientWidth - RIGHT_GUTTER

      mirror.style.fontSize = `${MAX_FONT_SIZE}px`
      const textWidth = mirror.scrollWidth

      if (textWidth > availableWidth && availableWidth > 0) {
        const ratio = availableWidth / textWidth
        // We use a slightly more conservative multiplier (0.97) for tight tracking
        const calculatedSize = Math.max(MAX_FONT_SIZE * ratio * 0.97, MIN_FONT_SIZE)
        setFontPx(calculatedSize)
      } else {
        setFontPx(MAX_FONT_SIZE)
      }
    }

    const observer = new ResizeObserver(adjustSize)
    observer.observe(container)
    adjustSize()

    return () => observer.disconnect()
  }, [value, isActive])

  const numericValue = value && !isNaN(parseFloat(cleanValue)) ? parseFloat(cleanValue) : null
  const decimalPlaces = cleanValue.includes(".") ? cleanValue.split(".")[1]?.length || 0 : 0
  const minFractionDigits = Math.min(decimalPlaces, 6)

  const inputContent = (
    <div
      ref={containerRef}
      className={cn("relative w-full h-[60px] flex items-center overflow-hidden")}
    >
      {/* 2. HIDDEN MIRROR 
          Crucially, we must include the EXACT same tracking class here 
          so the measurement accounts for the tight character spacing.
      */}
      <span
        ref={mirrorRef}
        className="absolute invisible whitespace-nowrap pointer-events-none font-bold tracking-tighter tabular-nums"
        aria-hidden="true"
      >
        {value || "0"}
      </span>

      {/* 3. THE VISUAL INTERFACE */}
      <div className="w-full flex items-center transition-[font-size] duration-200 ease-out h-[60px]">
        {isActive ? (
          <input
            ref={inputRef}
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="0"
            // Removed mr-2 to avoid push-back; replaced with precision gutter logic
            className={cn(
              "bg-transparent font-bold outline-none w-full placeholder:text-white/10 leading-none cursor-text caret-white tracking-tighter tabular-nums pr-1",
              showError ? "text-red-500" : "text-white"
            )}
            style={{ fontSize: `${fontPx}px` }}
            disabled={isDisabled}
          />
        ) : (
          <div
            className={cn(
              "font-bold leading-none tracking-tighter whitespace-nowrap pr-1",
              showError ? "text-red-500" : "text-white"
            )}
            style={{
              fontSize: `${fontPx}px`,
              fontVariantNumeric: "tabular-nums",
              ...(showError ? { color: "#ef4444" } : {}),
            }}
          >
            {numericValue !== null ? (
              <NumberFlow
                value={numericValue}
                format={{ minimumFractionDigits: minFractionDigits, maximumFractionDigits: 6 }}
                // Continuous ensures the digits roll without jumping widths
                style={
                  {
                    "--number-flow-char-gap": "-0.5px",
                    ...(showError ? { color: "#ef4444" } : {}),
                  } as React.CSSProperties
                }
              />
            ) : (
              <span className="text-white/10">0</span>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return <div className="flex-1 relative">{inputContent}</div>
}
