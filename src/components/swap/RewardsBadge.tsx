"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ArrowRight, Calculator, X } from "lucide-react"
import { Token } from "@/types/swap"

interface RewardsBadgeProps {
  toToken: Token | null
  milesToAmountOut: (targetMiles: number) => number | null
  onApply: (amountOut: string) => void
}

const formatAmount = (n: number): string => {
  if (n >= 1) return n.toFixed(Math.min(6, Math.max(2, 6 - Math.floor(Math.log10(n)))))
  if (n >= 0.0001) return n.toFixed(6)
  return n.toPrecision(3)
}

const RewardsBadgeComponent = ({ toToken, milesToAmountOut, onApply }: RewardsBadgeProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [target, setTarget] = useState("1")
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => {
    const n = parseFloat(target.replace(/,/g, ""))
    return Number.isFinite(n) && n > 0 ? n : null
  }, [target])

  const requiredAmountOut = useMemo(() => {
    if (parsed == null) return null
    return milesToAmountOut(parsed)
  }, [parsed, milesToAmountOut])

  // Skip the first effect run after open so we don't overwrite an existing
  // buy amount until the user actually edits the calculator.
  const lastAppliedRef = useRef<string | null>(null)
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!isOpen) return
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    const next = parsed != null && requiredAmountOut != null ? formatAmount(requiredAmountOut) : ""
    if (next !== lastAppliedRef.current) {
      lastAppliedRef.current = next
      onApply(next)
    }
  }, [isOpen, parsed, requiredAmountOut, onApply])

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        const end = el.value.length
        el.setSelectionRange(end, end)
      }, 320)
      return () => clearTimeout(t)
    }
    didMountRef.current = false
    lastAppliedRef.current = null
    setTarget("1")
  }, [isOpen])

  return (
    <div className="mt-6 flex justify-center">
      <div
        className={`relative h-10 w-full overflow-hidden rounded-full border border-primary/30 bg-gradient-to-r from-primary/20 to-primary/10 backdrop-blur-sm transition-[max-width] duration-300 ease-in-out sm:h-12 ${
          isOpen ? "max-w-full" : "max-w-[160px] sm:max-w-[180px]"
        }`}
      >
        {/* Collapsed and expanded layers stack absolutely so the pill animates
            its max-width while the contents crossfade. */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-hidden={isOpen}
          tabIndex={isOpen ? -1 : 0}
          className={`absolute inset-0 flex cursor-pointer items-center justify-center gap-2 px-3 transition-opacity duration-200 ease-in-out sm:px-4 ${
            isOpen ? "pointer-events-none opacity-0" : "opacity-100 delay-150"
          }`}
        >
          <div className="relative flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <div className="absolute h-2 w-2 rounded-full bg-primary animate-ping opacity-75" />
          </div>
          <span className="text-[11px] font-medium text-primary sm:text-xs">Calculate Miles</span>
          <Image
            src="/assets/fast-icon.png"
            alt="Fast"
            width={28}
            height={28}
            className="h-7 w-7 sm:h-8 sm:w-8"
            unoptimized
          />
        </button>

        <div
          aria-hidden={!isOpen}
          className={`absolute inset-0 flex items-center gap-2 px-3 transition-opacity duration-200 ease-in-out sm:gap-3 sm:px-4 ${
            isOpen ? "opacity-100 delay-150" : "pointer-events-none opacity-0"
          }`}
        >
          <Calculator className="h-4 w-4 shrink-0 text-primary" />

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="0"
              aria-label="Target miles"
              tabIndex={isOpen ? 0 : -1}
              className="w-full min-w-0 bg-transparent text-right text-base font-bold text-foreground outline-none tabular-nums placeholder:text-foreground/30 sm:text-lg"
            />
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-primary/70 sm:text-[11px]">
              miles
            </span>
          </div>

          <ArrowRight
            className={`h-4 w-4 shrink-0 transition-colors ${
              requiredAmountOut != null ? "text-primary" : "text-primary/30"
            }`}
          />

          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={`min-w-0 flex-1 truncate text-base font-bold tabular-nums sm:text-lg ${
                requiredAmountOut != null ? "text-primary" : "text-foreground/30"
              }`}
            >
              {requiredAmountOut != null ? formatAmount(requiredAmountOut) : "—"}
            </span>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-primary/70 sm:text-[11px]">
              {toToken?.symbol ?? "buy"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close calculator"
            tabIndex={isOpen ? 0 : -1}
            className="shrink-0 rounded-full p-0.5 text-primary/70 transition hover:bg-primary/10 hover:text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export const RewardsBadge = React.memo(RewardsBadgeComponent)
