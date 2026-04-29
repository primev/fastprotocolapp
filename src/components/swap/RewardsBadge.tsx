"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Calculator, X } from "lucide-react"

interface MilesPlan {
  slippage: string
  requiresChange: boolean
}

interface RewardsBadgeProps {
  milesToSlippage: (targetMiles: number) => MilesPlan | null
  /** Upper bound (reactive) on miles earnable at the user's CURRENT swap
   * size with max slippage (50%). Bounded by what they've already typed;
   * calc never changes the swap amount. */
  maxAchievableMiles: number | null
  /** Identity key for the user's current swap pair (`from-to`). When this
   *  changes — e.g. on switch-tokens — the calc resets back to the
   *  pre-Enable view. */
  swapInputsKey: string
  /** Monotonic counter incremented on every successful swap reset (after
   *  preconfirmation). When this changes the calc collapses entirely so a
   *  fresh swap starts with a clean badge. */
  swapResetCount: number
  onApply: (args: { slippage: string }) => void
  /** Called when the calculator is collapsed (X click). Used to reset
   *  the swap's slippage back to auto since calc-applied slippage is no
   *  longer in scope. */
  onClose?: () => void
}

const RewardsBadgeComponent = ({
  milesToSlippage,
  maxAchievableMiles,
  swapInputsKey,
  swapResetCount,
  onApply,
  onClose,
}: RewardsBadgeProps) => {
  // Three-way state machine for the calc view:
  //   isOpen=false             → collapsed badge ("Calculate Miles")
  //   isOpen=true, !isEnabled  → "Earn upto {max} miles" + [Enable]
  //   isOpen=true, isEnabled   → "Earn [input] of {max} miles" + [Calculate]
  const [isOpen, setIsOpen] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [target, setTarget] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => {
    const n = parseFloat(target.replace(/,/g, ""))
    return Number.isFinite(n) && n > 0 ? n : null
  }, [target])

  const plan = useMemo(() => {
    if (parsed == null) return null
    return milesToSlippage(parsed)
  }, [parsed, milesToSlippage])

  const maxMiles = maxAchievableMiles

  const handleEnable = () => {
    setIsEnabled(true)
    setTarget("")
  }

  // Explicit apply: only mutate slippage when the user hits Calculate or
  // Enter. We never touch the user's typed sell/buy amount — the calculator
  // is purely a slippage nudge.
  const handleCalculate = () => {
    if (parsed == null || plan == null) return
    if (!plan.requiresChange) return
    onApply({ slippage: plan.slippage })
  }

  // Reset to the pre-Enable view whenever the calc closes — next open shows
  // "Earn upto {max}" again, even after a successful Calculate.
  useEffect(() => {
    if (!isOpen) {
      setIsEnabled(false)
      setTarget("")
    }
  }, [isOpen])

  // Reset when the user changes/swaps tokens. The previous max/target is
  // stale for the new pair; user re-engages from the Enable view.
  useEffect(() => {
    setIsEnabled(false)
    setTarget("")
  }, [swapInputsKey])

  // Full reset when the swap completes (preconfirmation fires
  // `resetFormAfterSuccess`). The calc collapses to the badge; reopening
  // starts fresh. Skip the initial mount so opening the page doesn't auto-
  // collapse from "0 → 0".
  const initialResetRef = useRef(swapResetCount)
  useEffect(() => {
    if (swapResetCount === initialResetRef.current) return
    initialResetRef.current = swapResetCount
    setIsOpen(false)
    setIsEnabled(false)
    setTarget("")
  }, [swapResetCount])

  // Focus the input the moment we enter the active (Enable-clicked) view so
  // the user can type immediately.
  useEffect(() => {
    if (!isOpen || !isEnabled) return
    const t = setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
    }, 60)
    return () => clearTimeout(t)
  }, [isOpen, isEnabled])

  const canCalculate = parsed != null && plan != null && plan.requiresChange

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
          <Calculator className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            {isEnabled ? (
              <>
                <span className="shrink-0 text-sm font-medium text-primary/80 sm:text-base">
                  Earn
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.,]/g, "")
                    if (cleaned === "") {
                      setTarget("")
                      return
                    }
                    // Hard cap at maxMiles — user can't type a target above
                    // what's achievable. Clamp on every keystroke so they
                    // see the cap applied in real time.
                    const num = parseFloat(cleaned.replace(/,/g, ""))
                    if (
                      Number.isFinite(num) &&
                      maxMiles != null &&
                      maxMiles > 0 &&
                      num > maxMiles
                    ) {
                      setTarget(String(maxMiles))
                      return
                    }
                    setTarget(cleaned)
                  }}
                  onBlur={() => {
                    if (canCalculate) handleCalculate()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canCalculate) {
                      e.preventDefault()
                      handleCalculate()
                    }
                  }}
                  placeholder="0"
                  aria-label="Target miles"
                  tabIndex={isOpen ? 0 : -1}
                  className="w-20 min-w-0 bg-transparent text-center text-lg font-bold text-foreground outline-none tabular-nums placeholder:text-foreground/30 sm:text-xl"
                />
                <span className="shrink-0 text-sm font-medium text-primary/80 sm:text-base">
                  {maxMiles != null && maxMiles > 0
                    ? `of ${maxMiles.toLocaleString()} miles`
                    : "miles"}
                </span>
              </>
            ) : (
              <span
                className={`shrink-0 text-sm font-medium sm:text-base ${
                  maxMiles === 0 ? "text-amber-300/90" : "text-primary/80"
                }`}
              >
                {maxMiles == null
                  ? "Earn miles on this swap"
                  : maxMiles > 0
                    ? `Earn up to ${maxMiles.toLocaleString()} miles`
                    : "Swap too small to earn miles at current gas"}
              </span>
            )}
          </div>

          {isEnabled ? (
            <button
              type="button"
              onClick={handleCalculate}
              disabled={!canCalculate}
              tabIndex={isOpen ? 0 : -1}
              className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-1.5 sm:text-sm"
            >
              Apply
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={maxMiles == null || maxMiles <= 0}
              tabIndex={isOpen ? 0 : -1}
              className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-1.5 sm:text-sm"
            >
              Enable
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              onClose?.()
            }}
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
