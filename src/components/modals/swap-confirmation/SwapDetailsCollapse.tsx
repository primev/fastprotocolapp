"use client"

import NumberFlow from "@number-flow/react"
import { AlertTriangle, ChevronDown, Fuel } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Token } from "@/types/swap"
import { InfoRow } from "./InfoRow"
import { numberFlowStyle } from "./shared"

export interface SwapDetailsCollapseProps {
  // Always-visible tier
  priceImpact: number
  impactSeverity: "low" | "medium" | "high"
  /** Intent-path (Permit2) swaps have the relayer pay gas, so network cost is "Free". */
  intentPath: boolean
  gasCostUsd: number | null
  isWrap: boolean
  isUnwrap: boolean
  estimatedMiles: number | null | undefined

  // Expandable tier
  isExpanded: boolean
  onToggleExpanded: () => void
  tokenIn: Token | undefined
  tokenOut: Token | undefined
  exchangeRate: number
  /** Drives the min-fraction-digits rule on the rate display (stable → ≥2). */
  rateToStable: boolean
  isMaxIn: boolean
  slippageLimitFormatted: string
  slippage: string
}

// Renders the details section below the From/To summary. Two tiers:
//   - Always visible: price impact or "Free" fee row, network cost, miles.
//   - Expandable: rate, min/max received/sold, max slippage, order routing,
//     and (when not in the high-impact early-warning path) price impact.
// Splitting the two tiers would hurt readability here because they share the
// same styled container and toggle button. The whole block gets a dedicated
// file so the parent modal stays focused on orchestration.
export function SwapDetailsCollapse({
  priceImpact,
  impactSeverity,
  intentPath,
  gasCostUsd,
  isWrap,
  isUnwrap,
  estimatedMiles,
  isExpanded,
  onToggleExpanded,
  tokenIn,
  tokenOut,
  exchangeRate,
  rateToStable,
  isMaxIn,
  slippageLimitFormatted,
  slippage,
}: SwapDetailsCollapseProps) {
  return (
    <div className="px-5 sm:px-6 pb-3 bg-white/[0.02] border-y border-white/5">
      <div className="divide-y divide-white/5">
        {impactSeverity === "high" ? (
          <InfoRow
            label="Price impact"
            value={
              <span className="flex items-center gap-1.5 tabular-nums">
                {priceImpact < 0 && "-"}
                <NumberFlow
                  value={Math.abs(priceImpact)}
                  format={{
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: true,
                  }}
                  style={numberFlowStyle}
                />
                %
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-help">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[200px] bg-[#1c2128] border-white/10"
                    >
                      <p className="font-semibold text-red-400 mb-1">High Price Impact</p>
                      <p className="text-xs text-gray-300">
                        This trade will significantly move the market price. You may receive less
                        than expected.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            }
            tooltip="The difference between market price and estimated price due to trade size"
            valueClassName="text-red-400"
          />
        ) : (
          <InfoRow
            label="Fee"
            value="Free"
            tooltip="The fee charged for this swap"
            valueClassName="text-[#3898FF]"
          />
        )}
        <InfoRow
          label="Network cost"
          value={
            intentPath ? (
              <span className="text-[#3898FF]">Free</span>
            ) : (
              <span className="flex items-center gap-1.5 tabular-nums">
                <Fuel className="h-3.5 w-3.5 text-gray-500" />
                {gasCostUsd != null ? (
                  <>
                    $
                    <NumberFlow
                      value={gasCostUsd}
                      format={{
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        useGrouping: true,
                      }}
                      style={numberFlowStyle}
                    />
                  </>
                ) : (
                  "—"
                )}
              </span>
            )
          }
          tooltip={
            intentPath
              ? "No gas fee — relayer submits the transaction"
              : "Estimated gas fee for this transaction"
          }
        />
        {!isWrap && !isUnwrap && estimatedMiles != null && (
          <InfoRow
            label="Est. miles earned"
            value={
              estimatedMiles > 0 ? (
                <span className="tabular-nums">
                  ~
                  <NumberFlow
                    value={estimatedMiles}
                    format={{ useGrouping: true, maximumFractionDigits: 0 }}
                    style={numberFlowStyle}
                  />
                </span>
              ) : (
                <span className="text-gray-500">TBD</span>
              )
            }
            tooltip={
              estimatedMiles > 0 ? (
                "Estimated Fast Miles earned from MEV redistribution on this swap"
              ) : (
                <>
                  We are unable to show a miles estimate at this time. You may continue to earn
                  miles as your swap executes. See{" "}
                  <a
                    href="/learn/miles#about-the-miles-estimate"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 text-[#3898FF] hover:text-[#5aa9ff]"
                  >
                    Learn
                  </a>{" "}
                  for more info.
                </>
              )
            }
            valueClassName={estimatedMiles > 0 ? "text-[#3898FF]" : "text-gray-500"}
          />
        )}
      </div>

      <button
        onClick={onToggleExpanded}
        className="flex items-center justify-center gap-1.5 w-full py-2 mt-2 rounded-lg hover:bg-white/5 transition-all text-sm text-gray-400 hover:text-white"
      >
        {isExpanded ? "Show less" : "Show more"}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded
            ? "max-h-[300px] opacity-100 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            : "max-h-0 opacity-0"
        )}
      >
        <div className="divide-y divide-white/5 pt-2">
          <InfoRow
            label="Rate"
            value={
              <span className="tabular-nums">
                1 {tokenIn?.symbol ?? ""} ={" "}
                {exchangeRate.toLocaleString("en-US", {
                  minimumFractionDigits: rateToStable ? 2 : 0,
                  maximumSignificantDigits: 6,
                  useGrouping: true,
                })}{" "}
                {tokenOut?.symbol ?? ""}
              </span>
            }
            tooltip="Current exchange rate between tokens"
          />
          <InfoRow
            label={isMaxIn ? "Maximum sold" : "Minimum received"}
            value={(() => {
              const cleanSlippage = slippageLimitFormatted?.replace(/,/g, "") ?? "0"
              const slippageDecimals = cleanSlippage.includes(".")
                ? (cleanSlippage.split(".")[1]?.length ?? 0)
                : 0
              return (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <NumberFlow
                    value={parseFloat(cleanSlippage) || 0}
                    format={{
                      minimumFractionDigits: 0,
                      maximumFractionDigits: Math.max(6, slippageDecimals),
                      useGrouping: true,
                    }}
                    style={numberFlowStyle}
                  />{" "}
                  {isMaxIn ? (tokenIn?.symbol ?? "") : (tokenOut?.symbol ?? "")}
                </span>
              )
            })()}
            tooltip={
              isMaxIn
                ? "The maximum amount you will pay after slippage"
                : "The minimum amount you will receive after slippage"
            }
          />

          <InfoRow
            label="Max slippage"
            value={
              <span className="tabular-nums">
                {(parseFloat(slippage) || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                  useGrouping: true,
                })}
                %
              </span>
            }
            tooltip="Maximum price movement allowed before transaction reverts"
          />

          <InfoRow
            label="Order routing"
            value="Fast Protocol"
            tooltip="Protocol used to execute this swap"
          />
          {impactSeverity === "high" ? (
            <InfoRow
              label="Fee"
              value="Free"
              tooltip="The fee charged for this swap"
              valueClassName="text-[#3898FF]"
            />
          ) : (
            <InfoRow
              label="Price impact"
              value={
                <span className="flex items-center gap-1.5 tabular-nums">
                  {`${priceImpact >= 0 ? "" : "-"}${Math.abs(priceImpact).toFixed(2)}%`}
                  {impactSeverity === "medium" && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-help">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[200px] bg-[#1c2128] border-white/10"
                        >
                          <p className="font-semibold text-amber-400 mb-1">Medium Price Impact</p>
                          <p className="text-xs text-gray-300">
                            This trade may move the market price. Consider a smaller amount.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </span>
              }
              tooltip="The difference between market price and estimated price due to trade size"
              valueClassName={cn(
                impactSeverity === "low" && "text-emerald-400",
                impactSeverity === "medium" && "text-amber-400"
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}
