"use client"

/**
 * Shared building blocks used by both `UserSwapsTable` (inline dashboard
 * card) and `UserSwapsModal` (full-history dialog).
 *
 * This module exists to **break a circular import** between those two
 * files. Previously the table imported the modal (to render it from a
 * button) AND the modal imported helpers from the table, which Next.js +
 * Webpack SSR occasionally resolved as `undefined` on first client render
 * and caused a cascading hydration mismatch.
 *
 * Any helper used by both files belongs here. Neither `UserSwapsTable`
 * nor `UserSwapsModal` imports from each other — the table imports the
 * modal one-way, and both import shared parts from here.
 */

import Image from "next/image"
import { ArrowRight, ExternalLink, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UserSwapRow } from "@/hooks/use-user-swaps"
import { getEstimatedMilesForHash } from "@/lib/swap-events"

export const ETHERSCAN_TX_BASE = "https://etherscan.io/tx/"

/**
 * Formats a DB timestamp string into a compact relative label
 * (e.g. "2m ago", "3h ago", "5d ago"). Falls back to the ISO date slice
 * when older than a week.
 */
export function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "—"
  const parsed = Date.parse(
    // StarRocks returns "2026-04-08T19:14:59" without a trailing Z.
    // Treat these as UTC to avoid local-TZ skew.
    /Z$/.test(timestamp) ? timestamp : `${timestamp}Z`
  )
  if (!Number.isFinite(parsed)) return "—"

  const diffMs = Date.now() - parsed
  if (diffMs < 0) return "just now"

  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(parsed).toISOString().slice(0, 10)
}

/**
 * Abbreviates a tx hash for inline display. Keeps the leading 0x.
 */
export function shortHash(hash: string): string {
  if (hash.length <= 12) return hash
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

/**
 * Trim a pre-formatted decimal amount string (e.g. "107.926867") for
 * inline display next to a token symbol. Keeps the integer part intact
 * and caps fractional digits at 4 so the table stays compact without
 * lying about the order of magnitude.
 */
export function formatAmountInline(raw: string | null): string {
  if (!raw) return "—"
  const [intPart, fracPart] = raw.split(".")
  if (!fracPart) return intPart
  return `${intPart}.${fracPart.slice(0, 4)}`
}

/**
 * One side of a swap — logo, amount, and symbol grouped tightly so the
 * number visually belongs to its token. Logo is a compact prefix; amount
 * and symbol share the same color so the pair reads as a single unit.
 */
export function SwapSide({
  token,
  amount,
}: {
  token: UserSwapRow["tokenIn"]
  amount: string | null
}) {
  return (
    <span className="inline-flex items-center gap-1 md:gap-1.5 whitespace-nowrap tabular-nums">
      {token.logoURI ? (
        <Image
          src={token.logoURI}
          alt={token.symbol}
          width={16}
          height={16}
          className="rounded-full shrink-0"
          unoptimized
        />
      ) : (
        <span className="inline-block w-4 h-4 rounded-full bg-muted shrink-0" />
      )}
      <span className={token.unknown ? "text-muted-foreground" : ""}>
        <span className="text-xs md:text-sm">{formatAmountInline(amount)}</span>
        <span className="hidden md:inline"> {token.symbol}</span>
      </span>
    </span>
  )
}

/**
 * Conservative miles estimate for pending rows. Uses the surplus rate
 * (from Edge Config, updated daily by cron) and the 90% user share /
 * 100k miles-per-ETH constants.
 *
 * This is a rough floor — actual miles are computed post-settlement and
 * will overwrite this value once processed.
 */
const DEFAULT_SURPLUS_RATE = 0.0056
const USER_MEV_SHARE = 0.9
const MILES_PER_ETH = 100_000
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

/**
 * Cold-load fallback for the bid-cost proxy. The Edge-Config-driven value
 * (`miles_estimate_bid_cost_eth`, daily cron) is preferred when present —
 * this constant only kicks in until the first `/api/config/gas-estimate`
 * fetch returns. p75 of post-2026-04-08 realized distribution, matching
 * the cron's `FALLBACK_BID_COST_ETH`.
 */
const ESTIMATED_BID_COST_ETH = 0.00004

/**
 * Discriminates which input fed the displayed estimate so the UI can
 * tell the user *why* the dashboard number may not match what they saw at
 * swap time. `realized` means we recomputed from on-chain settlement data;
 * `prior` means a population-average fallback; `null` for both means the
 * caller should fall back to the swap-time stash or "TBD".
 */
type EstimateSource = "realized" | "prior" | null

type MilesEstimate = {
  miles: number | null
  source: EstimateSource
}

/**
 * Miles estimate for a pending row.
 *
 * Preferred path (`realized`): the indexer writes `surplus` and `gas_cost`
 * the moment the tx is seen, so we recompute miles using the same forward
 * formula the finalizer will run — but with on-chain values instead of the
 * pre-trade barter prediction the swap UI used. This is the value we want
 * to show on the dashboard; it tracks reality, not the user's expectation.
 * Only `bid_cost` is NULL until finalize, and we proxy it with the post-fix
 * p75 constant above.
 *
 * Fallback (`prior`): if `surplus` isn't populated yet (rare race window
 * between tx submission and the indexer catching up), or the output is a
 * non-ETH token we can't convert here without a price oracle, return the
 * old `surplusRate × amountOut × 0.9 × 100k` population-prior estimate.
 *
 * Returns `{miles: null, source: null}` when neither path can produce
 * anything; the caller then shows the swap-time stash if available, else
 * "TBD".
 */
function estimateMiles(row: UserSwapRow, surplusRate: number, bidCostEth: number): MilesEstimate {
  if (!row.amountOut) return { miles: null, source: null }

  // Dashboard only handles ETH-output rows in the realized path because
  // surplus is in output-token units and we'd need a token price to convert
  // it to ETH for the math below.
  const outSymbol = row.tokenOut.symbol.toUpperCase()
  const isEthOut = outSymbol === "ETH" || outSymbol === "WETH"

  // Preferred: realized on-chain values. Same formula the finalizer uses,
  // matching the swap-time forward calc up to the bid_cost proxy.
  if (isEthOut && row.surplus != null && row.gasCost != null) {
    const surplusNum = Number(row.surplus)
    const gasNum = Number(row.gasCost)
    if (Number.isFinite(surplusNum) && surplusNum > 0 && Number.isFinite(gasNum) && gasNum >= 0) {
      const surplusEth = surplusNum / 1e18

      // Native-ETH input: user paid L1 gas out of their own wallet, not out of
      // the swap output, so miles math doesn't subtract it (matches the UI
      // estimator's ETH-path branch and the finalizer's behavior).
      // ERC20 (Permit2) input: relayer paid gas, subtract it.
      const isEthInput = row.tokenIn.address.toLowerCase() === ZERO_ADDRESS
      const gasCostEth = isEthInput ? 0 : gasNum / 1e18

      const netMev = surplusEth - bidCostEth - gasCostEth
      if (netMev <= 0) return { miles: 0, source: "realized" }
      const userMev = netMev * USER_MEV_SHARE
      return { miles: Math.floor(userMev * MILES_PER_ETH), source: "realized" }
    }
  }

  // Fallback: population prior × displayed output. Same as the pre-change
  // formula — used only when realized surplus/gas aren't available yet.
  const parsed = parseFloat(row.amountOut)
  if (!parsed || parsed <= 0) return { miles: null, source: null }
  const mevPot = surplusRate * parsed
  const userMev = mevPot * USER_MEV_SHARE
  const miles = Math.floor(userMev * MILES_PER_ETH)
  return miles > 0 ? { miles, source: "prior" } : { miles: null, source: null }
}

/**
 * Miles column renderer. Shows estimated miles (with ~ prefix) while
 * pending, and the real finalized value once processed.
 *
 * Estimate priority for pending rows:
 *   1. Re-run the forward calc against on-chain data (`surplus` + `gas_cost`).
 *      This is the most accurate signal we have before the finalizer runs and
 *      may differ from the swap-time number — when it does, we surface a
 *      tooltip so the user understands why.
 *   2. Stashed estimate from the swap UI (via sessionStorage, survives
 *      navigation). Used only as a backstop when the indexer hasn't written
 *      surplus/gas yet, or when the output token is a non-ETH ERC20 we can't
 *      convert without a price oracle.
 *   3. Population-prior calculation from output amount.
 *   4. "TBD" if none of the above produce a value.
 */
export function MilesCell({
  row,
  surplusRate = DEFAULT_SURPLUS_RATE,
  bidCostEth = ESTIMATED_BID_COST_ETH,
}: {
  row: UserSwapRow
  surplusRate?: number
  bidCostEth?: number
}) {
  if (!row.processed) {
    const recomputed = estimateMiles(row, surplusRate, bidCostEth)
    const stashed = getEstimatedMilesForHash(row.txHash)

    // Prefer the on-chain recompute over the swap-time stash. The recompute
    // uses realized surplus/gas, which is closer to what the finalizer will
    // award than the pre-trade barter prediction the swap UI displayed.
    //
    // Sanity gate: if a swap-time stash exists and the realized recompute is
    // wildly off (>3× or <1/3×), the indexer is likely mid-write — surplus
    // populated, gas_cost still 0, or vice versa. Trust the stash until the
    // recompute settles into a plausible range. Without this gate we've seen
    // ~12 miles → ~10k miles flicker as gas_cost arrives a beat after surplus.
    const realizedMiles = recomputed.source === "realized" ? recomputed.miles : null
    const realizedLooksSane =
      realizedMiles != null &&
      (stashed == null ||
        stashed <= 0 ||
        (realizedMiles > 0 && realizedMiles <= stashed * 3 && realizedMiles >= stashed / 3) ||
        realizedMiles === 0)

    let miles: number | null = null
    let source: EstimateSource | "stashed" = null
    if (realizedLooksSane && realizedMiles != null) {
      miles = realizedMiles
      source = "realized"
    } else if (stashed != null && stashed > 0) {
      miles = stashed
      source = "stashed"
    } else if (recomputed.source === "prior" && recomputed.miles != null) {
      miles = recomputed.miles
      source = "prior"
    } else if (realizedMiles != null) {
      // No stash to compare against — fall through and trust the recompute.
      miles = realizedMiles
      source = "realized"
    }

    if (miles == null) {
      return (
        <Badge variant="outline" className="text-muted-foreground font-normal">
          TBD
        </Badge>
      )
    }

    const badge = (
      <Badge variant="outline" className="text-muted-foreground font-normal cursor-help">
        ~{miles.toLocaleString()} miles
      </Badge>
    )

    // Only attach the "why does this differ?" tooltip on the realized path —
    // that's the case where the user can see two different numbers (swap UI
    // vs dashboard) and wonder which is right.
    if (source === "realized") {
      const differsFromSwapUi = stashed != null && stashed !== miles
      return (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent side="left" className="max-w-[280px] text-xs">
              {differsFromSwapUi
                ? `Refined estimate using on-chain settlement data. May differ from the ~${stashed!.toLocaleString()} miles shown at swap time. Final miles credited after settlement.`
                : "Refined estimate using on-chain settlement data — more accurate than the swap-time prediction. Final miles credited after settlement."}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return badge
  }
  if (row.miles == null || row.miles === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground font-normal">
        0 miles
      </Badge>
    )
  }
  return (
    <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
      +{row.miles.toLocaleString()} miles
    </Badge>
  )
}

/**
 * Status indicator dot. Yellow pulsing dot for pending settlement,
 * solid green dot for settled. The column header tooltip explains
 * the color meanings.
 */
export function StatusCell({ row }: { row: UserSwapRow }) {
  const settled = row.processed

  return (
    <span
      className="relative inline-flex h-2.5 w-2.5"
      aria-label={settled ? "Settled" : "Pending settlement"}
    >
      {!settled && <span className="absolute inset-0 rounded-full bg-yellow-400/60 animate-ping" />}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
          settled ? "bg-emerald-400" : "bg-yellow-400"
        }`}
      />
    </span>
  )
}

/**
 * Shared table body — the actual rows + columns. Used by both the inline
 * dashboard card and the full-history modal so columns and formatting
 * stay in lockstep.
 */
export function SwapsTableBody({
  swaps,
  surplusRate,
  bidCostEth,
}: {
  swaps: UserSwapRow[]
  surplusRate?: number
  bidCostEth?: number
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs md:text-sm px-2 md:px-4">Time</TableHead>
          <TableHead className="text-xs md:text-sm px-2 md:px-4">Swap</TableHead>
          <TableHead className="text-right text-xs md:text-sm px-2 md:px-4">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 cursor-help">
                    Miles
                    <Info className="h-3.5 w-3.5 text-muted-foreground hidden md:inline" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                  Your total miles from Fast Swaps, FastRPC, and Referrals
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableHead>
          <TableHead className="text-right hidden md:table-cell px-4">Tx</TableHead>
          <TableHead className="text-center w-6 md:w-10 px-1 md:px-4">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 cursor-help">
                    <span className="hidden md:inline">Status</span>
                    <Info className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
                      <span>Pending settlement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                      <span>Settled on-chain</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {swaps.map((row) => (
          <TableRow key={row.txHash}>
            <TableCell className="text-muted-foreground whitespace-nowrap text-xs md:text-sm px-2 md:px-4">
              {formatRelativeTime(row.blockTimestamp)}
            </TableCell>
            <TableCell className="px-2 md:px-4">
              <span className="inline-flex items-center">
                <SwapSide token={row.tokenIn} amount={row.amountIn} />
                <ArrowRight className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground mx-1.5 md:mx-3 shrink-0" />
                <SwapSide token={row.tokenOut} amount={row.amountOut} />
              </span>
            </TableCell>
            <TableCell className="text-right px-2 md:px-4">
              <MilesCell row={row} surplusRate={surplusRate} bidCostEth={bidCostEth} />
            </TableCell>
            <TableCell className="text-right hidden md:table-cell px-4">
              <a
                href={`${ETHERSCAN_TX_BASE}${row.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                title={row.txHash}
              >
                {shortHash(row.txHash)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </TableCell>
            <TableCell className="text-center px-1 md:px-4">
              <StatusCell row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
