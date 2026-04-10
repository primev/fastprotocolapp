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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { UserSwapRow } from "@/hooks/use-user-swaps"

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
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      {token.logoURI ? (
        <Image
          src={token.logoURI}
          alt={token.symbol}
          width={16}
          height={16}
          className="rounded-full"
          unoptimized
        />
      ) : (
        <span className="inline-block w-4 h-4 rounded-full bg-muted" />
      )}
      <span className={token.unknown ? "text-muted-foreground" : ""}>
        {formatAmountInline(amount)} {token.symbol}
      </span>
    </span>
  )
}

/**
 * Miles column renderer. Handles three states:
 *   1. `processed=false`  → "Processing" badge (polling will update)
 *   2. `processed=true && miles > 0` → "+{miles} miles" (primary colour)
 *   3. `processed=true && miles == 0` → "0 miles" (muted)
 *
 * Note: `row.miles` is the pre-fee value submitted for the swap. A 2%
 * referral fee is deducted before crediting the user's visible balance,
 * which is why row totals may sum higher than the header total. The
 * tooltip in {@link MilesDiscrepancyInfo} explains this to users.
 */
export function MilesCell({ row }: { row: UserSwapRow }) {
  if (!row.processed) {
    return (
      <Badge variant="outline" className="font-normal">
        Processing
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
 * Shared table body — the actual rows + columns. Used by both the inline
 * dashboard card and the full-history modal so columns and formatting
 * stay in lockstep.
 */
export function SwapsTableBody({ swaps }: { swaps: UserSwapRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Swap</TableHead>
          <TableHead className="text-right">Miles</TableHead>
          <TableHead className="text-right">Tx</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {swaps.map((row) => (
          <TableRow key={row.txHash}>
            <TableCell className="text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(row.blockTimestamp)}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center">
                <SwapSide token={row.tokenIn} amount={row.amountIn} />
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mx-3" />
                <SwapSide token={row.tokenOut} amount={row.amountOut} />
              </span>
            </TableCell>
            <TableCell className="text-right">
              <MilesCell row={row} />
            </TableCell>
            <TableCell className="text-right">
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * Small info icon + tooltip surfacing the row-total vs. header-total
 * discrepancy. The pill on both the table card and the modal is the
 * pre-fee sum of swap miles; the header balance has a 2% referral fee
 * deducted and can also include non-swap credits (referrals, tasks).
 */
export function MilesDiscrepancyInfo() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="How miles totals are calculated"
            className="inline-flex items-center text-muted-foreground hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] text-xs">
          This total is the sum of miles credited across all your Fast Swaps, shown after a 2%
          referral fee is deducted (if applicable).
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
