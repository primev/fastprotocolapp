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

const DEFAULT_SURPLUS_RATE = 0.0056
const USER_MEV_SHARE = 0.9
const MILES_PER_ETH = 100_000
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

/**
 * Proxy for bid_cost on pending rows. The indexer writes surplus and gas_cost
 * immediately but leaves bid_cost NULL until the sweep finalizer runs, so the
 * dashboard can't read the realized value.
 *
 * Set to p75 of realized bid_cost across processed rows since 2026-04-08 (the
 * day the bid-cost reduction landed). That picks a slightly-conservative
 * constant: it over-estimates cost vs. the median, which under-promises miles,
 * matching the same under-promise philosophy the cron uses for surplus rate.
 *
 * Post-fix distribution (n=745): p25=3.01e-5, p50=3.38e-5, p75=3.95e-5,
 * p95=5.38e-5. Tight enough that a single constant is fine.
 */
const ESTIMATED_BID_COST_ETH = 0.00004

/**
 * Miles estimate for a pending row.
 *
 * Preferred path: the indexer has already written realized `surplus` and
 * `gas_cost` to the row (it populates these the moment the tx is seen), so we
 * can compute the miles the finalizer will eventually award — not a population
 * prior, actual per-tx math. Only `bid_cost` is NULL until finalize, and we
 * proxy it with the post-fix p75 constant above.
 *
 * Fallback: if `surplus` isn't populated yet (rare race window between tx
 * submission and the indexer catching up), or the output is a non-ETH token
 * we can't convert here without a price oracle, fall back to the old
 * `surplusRate × amountOut × 0.9 × 100k` population-prior estimate.
 *
 * Returns null when even the fallback can't produce something meaningful;
 * the caller renders "TBD" in that case.
 */
function estimateMiles(row: UserSwapRow, surplusRate: number): number | null {
  if (!row.amountOut) return null

  // Dashboard only handles ETH-output rows in the realized path because
  // surplus is in output-token units and we'd need a token price to convert
  // it to ETH for the math below. ERC20-output pending rows stay as TBD.
  const outSymbol = row.tokenOut.symbol.toUpperCase()
  const isEthOut = outSymbol === "ETH" || outSymbol === "WETH"
  if (!isEthOut) return null

  // Preferred: realized on-chain values.
  if (row.surplus != null && row.gasCost != null) {
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

      const netMev = surplusEth - ESTIMATED_BID_COST_ETH - gasCostEth
      if (netMev <= 0) return 0
      const userMev = netMev * USER_MEV_SHARE
      return Math.floor(userMev * MILES_PER_ETH)
    }
  }

  // Fallback: population prior × displayed output. Same as the pre-change
  // formula — used only when realized surplus/gas aren't available yet.
  const parsed = parseFloat(row.amountOut)
  if (!parsed || parsed <= 0) return null
  const mevPot = surplusRate * parsed
  const userMev = mevPot * USER_MEV_SHARE
  const miles = Math.floor(userMev * MILES_PER_ETH)
  return miles > 0 ? miles : null
}

/**
 * Miles column renderer. Shows estimated miles (with ~ prefix) while
 * pending, and the real finalized value once processed.
 *
 * Estimate priority:
 *   1. Stashed estimate from the swap UI (via sessionStorage, survives navigation)
 *   2. Local calculation from output amount (ETH/WETH only)
 *   3. "TBD" if neither is available
 */
export function MilesCell({
  row,
  surplusRate = DEFAULT_SURPLUS_RATE,
}: {
  row: UserSwapRow
  surplusRate?: number
}) {
  if (!row.processed) {
    const stashed = getEstimatedMilesForHash(row.txHash)
    const est = stashed ?? estimateMiles(row, surplusRate)
    if (est != null && est > 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground font-normal">
          ~{est.toLocaleString()} miles
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-muted-foreground font-normal">
        TBD
      </Badge>
    )
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
}: {
  swaps: UserSwapRow[]
  surplusRate?: number
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
              <MilesCell row={row} surplusRate={surplusRate} />
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
