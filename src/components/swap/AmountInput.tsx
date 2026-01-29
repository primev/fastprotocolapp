"use client"

import React, { useRef, useState, useLayoutEffect } from "react"
import NumberFlow from "@number-flow/react"
import { cn } from "@/lib/utils"

/**
 * Strictly pruned interface containing only active parameters.
 * Removed pulse-related props and debug logs for production readiness.
 */
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
}

export default function AmountInput({
  value,
  onChange,
  onFocus,
  onBlur,
  isActive,
  isDisabled,
  showError,
  inputRef,
}: AmountInputProps) {
  // 1. VALUE CALCULATIONS
  // Sanitizing commas and handling the edge case of "No liquidity" text
  const isSpecialValue = value === "No liquidity"
  const cleanValue = value && !isSpecialValue ? value.replace(/,/g, "") : ""

  // Logic for NumberFlow formatting to match input precision
  const numericValue = value && !isNaN(parseFloat(cleanValue)) ? parseFloat(cleanValue) : null
  const decimalPlaces = cleanValue.includes(".") ? cleanValue.split(".")[1]?.length || 0 : 0
  const minFractionDigits = Math.min(decimalPlaces, 6)

  // 2. DYNAMIC FONT SCALING STATE & REFS
  const [fontPx, setFontPx] = useState(36)
  const containerRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLSpanElement>(null)

  /**
   * useLayoutEffect handles the "Mirror Measurement" strategy.
   * It calculates the width of the text in a hidden span before the browser paints,
   * shrinking the font size if the text exceeds the container width.
   */
  useLayoutEffect(() => {
    const container = containerRef.current
    const mirror = mirrorRef.current
    if (!container || !mirror) return

    const MAX_FONT_SIZE = 36
    const MIN_FONT_SIZE = 14
    const RIGHT_GUTTER = 4 // Safety buffer to prevent character clipping at the edge

    const adjustSize = () => {
      const availableWidth = container.clientWidth - RIGHT_GUTTER

      // Reset mirror to max to measure the "natural" width of the current string
      mirror.style.fontSize = `${MAX_FONT_SIZE}px`
      const textWidth = mirror.scrollWidth

      if (textWidth > availableWidth && availableWidth > 0) {
        const ratio = availableWidth / textWidth
        // 0.97 multiplier adds a tiny safety margin for tight letter tracking
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

  // 3. RENDER LOGIC
  return (
    <div className="flex-1 relative">
      <div
        ref={containerRef}
        className="relative w-full h-[60px] flex items-center overflow-hidden"
      >
        {/* HIDDEN MIRROR: 
            Used solely for measuring text width. Must share the exact 
            font-weight and tracking classes as the visible input.
        */}
        <span
          ref={mirrorRef}
          className="absolute invisible whitespace-nowrap pointer-events-none font-bold tracking-tighter tabular-nums"
          aria-hidden="true"
        >
          {value || "0"}
        </span>

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
              disabled={isDisabled}
              className={cn(
                "bg-transparent font-bold outline-none w-full placeholder:text-white/10 leading-none cursor-text caret-white tracking-tighter tabular-nums pr-1",
                showError ? "text-red-500" : "text-white"
              )}
              style={{ fontSize: `${fontPx}px` }}
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
              }}
            >
              {numericValue !== null ? (
                <NumberFlow
                  value={numericValue}
                  format={{
                    minimumFractionDigits: minFractionDigits,
                    maximumFractionDigits: 6,
                  }}
                  style={
                    {
                      "--number-flow-char-gap": "-0.5px",
                      // Use CSS transition-duration for speed control
                      "--number-flow-mask-duration": "0.3s",
                      // Use a custom cubic-bezier for a "luxury" feel
                      "--number-flow-mask-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
                      fontVariantNumeric: "tabular-nums", // Essential for odometer stability
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
    </div>
  )
}
