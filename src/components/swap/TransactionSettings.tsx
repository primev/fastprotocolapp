"use client"

import React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover"
import { Info, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { SlippageMode, SlippageWarning } from "@/hooks/use-swap-slippage"

interface TransactionSettingsProps {
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void
  slippage: string
  handleSlippageChange: (slippage: string) => void
  commitSlippage: () => void
  internalDeadline: number
  setInternalDeadline: (deadline: number) => void
  isMounted: boolean
  mode: SlippageMode
  setMode: (mode: SlippageMode) => void
  customMin: number
  autoBase: number
  autoBumpedForGas: boolean
  slippageWarning: SlippageWarning
}

const WARNING_MESSAGE =
  "Slippage above 5% is unusual. You will earn more miles, but will likely receive less tokens."
const AUTO_BUMP_MESSAGE = "Your slippage has been auto-adjusted to cover gas costs"

const TransactionSettingsComponent: React.FC<TransactionSettingsProps> = ({
  isSettingsOpen,
  setIsSettingsOpen,
  slippage,
  handleSlippageChange,
  commitSlippage,
  internalDeadline,
  setInternalDeadline,
  mode,
  setMode,
  customMin,
  autoBase,
  autoBumpedForGas,
  slippageWarning,
}) => {
  // Pill/gear visual: amber whenever slippage sits above the auto-mode
  // BASELINE (= max(autoBase, buffer)) — covers auto-bumped, custom-set-high,
  // and calc-applied bumps. At or below the baseline (e.g. the 1% default
  // for ETH input) the gear has no badge — that's just "auto-default."
  // Mirrors AUTO_BUMP_BUFFER_PCT from use-swap-slippage.
  const AUTO_BUMP_BUFFER_PCT = 1.0
  const autoBaseline = Math.max(autoBase, AUTO_BUMP_BUFFER_PCT)
  const slippagePct = parseFloat(slippage)
  const isElevatedSlippage = Number.isFinite(slippagePct) && slippagePct > autoBaseline
  const showSlippageBadge = isElevatedSlippage

  // The popup notice copy specifically references the AUTO mode bump and
  // should only appear when auto mode actually bumped (per product spec).
  const isAutoBumpNoticeOpen = mode === "auto" && autoBumpedForGas

  const isWarningOpen = slippageWarning !== "none"

  return (
    <div className="flex items-center justify-between w-full mb-2">
      <span className="text-xl font-semibold text-white">Swap</span>

      <Popover
        open={isSettingsOpen}
        onOpenChange={(open) => {
          // Commit on close so an empty/invalid value flips back to auto even
          // if the input's blur event was pre-empted by Radix unmounting content.
          if (!open && mode === "custom") commitSlippage()
          setIsSettingsOpen(open)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group relative flex items-center justify-end rounded-xl transition-colors duration-300 active:scale-95 outline-none border-none h-9 overflow-hidden",
              !showSlippageBadge && "bg-transparent w-9",
              showSlippageBadge && !isElevatedSlippage && "bg-primary/10 text-primary pl-4 pr-3",
              showSlippageBadge && isElevatedSlippage && "bg-amber-500/10 text-amber-300 pl-4 pr-3"
            )}
            aria-label="Transaction settings"
          >
            <div className="flex items-center gap-2">
              {showSlippageBadge && (
                <span className="text-[13px] font-bold whitespace-nowrap">{slippage}%</span>
              )}

              <Settings
                className={cn(
                  "h-5 w-5 transition-transform duration-300 ease-in-out group-hover:rotate-90 shrink-0",
                  !showSlippageBadge && "text-zinc-400 group-hover:text-white",
                  showSlippageBadge && !isElevatedSlippage && "text-primary",
                  showSlippageBadge && isElevatedSlippage && "text-amber-300"
                )}
              />
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[400px] bg-[#0d1117] border border-white/5 p-5 rounded-[24px] shadow-2xl z-50"
        >
          <div
            aria-live="polite"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              isWarningOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden">
              <div className="pb-3">
                <div className="rounded-xl px-3 py-2 border border-amber-500/30 bg-amber-500/10">
                  <span className="text-[12px] leading-snug text-amber-200">{WARNING_MESSAGE}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            aria-live="polite"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              isAutoBumpNoticeOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden">
              <div className="pb-3">
                <div className="rounded-xl px-3 py-2 border border-amber-500/30 bg-amber-500/10">
                  <span className="text-[12px] leading-snug text-amber-200">
                    {AUTO_BUMP_MESSAGE}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[15px] font-medium text-zinc-200 whitespace-nowrap">
                  Max slippage
                </span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-zinc-500 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[220px] bg-[#161b22] border-white/10"
                    >
                      <p className="text-xs text-gray-300">
                        Maximum price movement allowed before transaction reverts. Auto adjusts to
                        cover routing and gas costs. Min {autoBase}%, max 50%.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full bg-white/[0.04] border border-white/10 p-0.5">
                  <button
                    type="button"
                    onClick={() => setMode("auto")}
                    className={cn(
                      "text-[12px] font-semibold px-3 py-1 rounded-full transition-all",
                      mode === "auto" ? "bg-primary text-black" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("custom")}
                    className={cn(
                      "text-[12px] font-semibold px-3 py-1 rounded-full transition-all",
                      mode === "custom" ? "bg-primary text-black" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Custom
                  </button>
                </div>

                <div
                  className={cn(
                    "flex items-center border rounded-full px-3 py-1.5 min-w-[92px] justify-end transition-colors",
                    mode === "custom"
                      ? "border-white/10 bg-white/[0.02]"
                      : "border-white/5 bg-white/[0.01]"
                  )}
                >
                  <div className="flex items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={slippage}
                      readOnly={mode === "auto"}
                      onChange={(e) => handleSlippageChange(e.target.value)}
                      onBlur={() => {
                        if (mode === "custom") commitSlippage()
                      }}
                      className={cn(
                        "w-14 bg-transparent text-right text-[15px] font-medium outline-none focus:ring-0 text-white",
                        mode === "auto" ? "cursor-default" : "cursor-text"
                      )}
                    />
                    <span className="text-[15px] text-zinc-500 ml-0.5 font-medium">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[15px] font-medium text-zinc-200">Swap deadline</span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-zinc-500 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[200px] bg-[#161b22] border-white/10"
                    >
                      <p className="text-xs text-gray-300">
                        Transaction will revert if not confirmed within this time
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center bg-[#161b22] border border-white/5 rounded-full px-4 py-2 min-w-[140px] justify-center gap-2">
                <input
                  type="text"
                  value={internalDeadline}
                  onChange={(e) => setInternalDeadline(Number(e.target.value.replace(/\D/g, "")))}
                  className="w-8 bg-transparent text-center text-[15px] text-white font-medium outline-none focus:ring-0"
                />
                <span className="text-[15px] text-zinc-500 font-medium">minutes</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export const TransactionSettings = React.memo(TransactionSettingsComponent)
