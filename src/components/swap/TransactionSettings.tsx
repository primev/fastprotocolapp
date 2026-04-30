"use client"

import React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover"
import { Info, Settings, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { SlippageMode, SlippageWarning } from "@/hooks/use-swap-slippage"
import { ProEngageCelebration } from "./ProEngageCelebration"

interface TransactionSettingsProps {
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void
  slippage: string
  handleSlippageChange: (slippage: string) => void
  commitSlippage: () => void
  internalDeadline: number
  setInternalDeadline: (deadline: number) => void
  isMounted: boolean
  isProMode: boolean
  proEligible: boolean
  proJustActivated: boolean
  onTogglePro: () => void
  proMinUsd: number
  mode: SlippageMode
  setMode: (mode: SlippageMode) => void
  customMin: number
  autoBase: number
  autoBumpedForGas: boolean
  slippageWarning: SlippageWarning
}

const WARNING_MESSAGE =
  "Slippage above 5% is unusual. You will earn more miles, but will likely receive less tokens."

const TransactionSettingsComponent: React.FC<TransactionSettingsProps> = ({
  isSettingsOpen,
  setIsSettingsOpen,
  slippage,
  handleSlippageChange,
  commitSlippage,
  internalDeadline,
  setInternalDeadline,
  isProMode,
  proEligible,
  proJustActivated,
  onTogglePro,
  proMinUsd,
  mode,
  setMode,
  customMin,
  autoBase,
  autoBumpedForGas,
  slippageWarning,
}) => {
  // Show the badge whenever the user has deviated from the base (custom mode) or
  // the auto mode has bumped up to cover gas costs.
  const showSlippageBadge = mode === "custom" || autoBumpedForGas

  const isWarningOpen = slippageWarning !== "none"

  return (
    <div className="flex items-center justify-between w-full mb-2">
      <span className="text-xl font-semibold text-white">{isProMode ? "Pro Swap" : "Swap"}</span>

      <div className="flex items-center gap-1">
        {/* Pro Mode Toggle */}
        {proEligible && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onTogglePro}
                  className={cn(
                    "relative flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-semibold transition-all duration-300 outline-none",
                    isProMode
                      ? "bg-primary/10 text-primary pro-border-glow"
                      : "text-zinc-500 hover:text-zinc-300",
                    proJustActivated && "animate-pro-shake"
                  )}
                  aria-pressed={isProMode}
                >
                  <ProEngageCelebration active={proJustActivated} />
                  <Zap
                    className={cn(
                      "h-3.5 w-3.5 transition-all duration-300",
                      isProMode ? "text-primary fill-primary" : "text-zinc-500"
                    )}
                  />
                  Pro
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px] bg-[#161b22] border-white/10">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Guarantees your transaction lands in the top 10% of the block, reducing reordering
                  slippage from MEV bots.
                </p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Available for swaps ≥ ${proMinUsd.toLocaleString()} USD. Smaller trades receive
                  standard block placement.
                </p>
                <a
                  href="/learn/pro-swaps"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-1.5 text-[11px] text-primary hover:text-primary/80 underline underline-offset-2"
                >
                  Learn how Pro works →
                </a>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

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
                "group relative flex items-center justify-end rounded-xl transition-all duration-300 active:scale-95 outline-none border-none h-9 overflow-hidden",
                showSlippageBadge
                  ? "bg-primary/10 text-primary w-[108px] px-3"
                  : "bg-transparent w-9"
              )}
              aria-label="Transaction settings"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 flex items-center justify-end",
                    showSlippageBadge ? "w-[60px] opacity-100" : "w-0 opacity-0"
                  )}
                >
                  <span className="text-[13px] font-bold whitespace-nowrap">{slippage}%</span>
                </div>

                <Settings
                  className={cn(
                    "h-5 w-5 transition-all duration-300 ease-in-out group-hover:rotate-90 shrink-0",
                    showSlippageBadge ? "text-primary" : "text-zinc-400 group-hover:text-white"
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
                    <span className="text-[12px] leading-snug text-amber-200">
                      {WARNING_MESSAGE}
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
                        mode === "custom"
                          ? "bg-primary text-black"
                          : "text-zinc-400 hover:text-white"
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
    </div>
  )
}

export const TransactionSettings = React.memo(TransactionSettingsComponent)
