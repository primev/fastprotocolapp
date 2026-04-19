import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSheetsClient } from "@/lib/google-sheets"
import {
  getWaitlistSheetCache,
  setWaitlistSheetCache,
  getWhitelistSheetCache,
  setWhitelistSheetCache,
} from "@/lib/waitlist-sheet-cache"
import { parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"
// address(A), listA(B), listB(C), listC(D), priority(E), acceptedInvite(F), swapCount(G)
const WHITELIST_RANGE = "'Swap Whitelist'!A:G"

// Explicit type because `position: null` would otherwise infer as `any`
// under noImplicitAny — and this shape is the wire contract with the UI.
type GateStatusResponse = {
  whitelisted: boolean
  approved: boolean
  onWaitlist: boolean
  acceptedInvite: boolean
  position: number | null
  total: number
}

const EMPTY_RESPONSE: GateStatusResponse = {
  whitelisted: false,
  approved: false,
  onWaitlist: false,
  acceptedInvite: false,
  position: null,
  total: 0,
}

const querySchema = z.object({ address: walletAddressSchema })

async function fetchWaitlistRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: any,
  spreadsheetId: string
): Promise<string[][]> {
  const cached = getWaitlistSheetCache()
  if (cached) return cached
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WAITLIST_RANGE })
  const rows = (result.data.values ?? []) as string[][]
  setWaitlistSheetCache(rows)
  return rows
}

async function fetchWhitelistRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: any,
  spreadsheetId: string
): Promise<string[][]> {
  const cached = getWhitelistSheetCache()
  if (cached) return cached
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WHITELIST_RANGE })
  const rows = (result.data.values ?? []) as string[][]
  setWhitelistSheetCache(rows)
  return rows
}

/**
 * Single consolidated endpoint that returns all gate status in one call.
 * Replaces separate /api/whitelist/list, /api/waitlist/list,
 * /api/waitlist/position, and /api/waitlist/accept-invite GET calls.
 */
export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const address = parsed.address // already lower-cased

  try {
    const { sheets, spreadsheetId } = await getSheetsClient()

    const [waitlistRows, whitelistRows] = await Promise.all([
      fetchWaitlistRows(sheets, spreadsheetId),
      fetchWhitelistRows(sheets, spreadsheetId),
    ])

    // Whitelist: col A = address, col F (index 5) = acceptedInvite
    const whitelistMatch = whitelistRows.find((row) => row[0]?.trim().toLowerCase() === address)
    const whitelisted = Boolean(whitelistMatch)
    const acceptedInvite = whitelistMatch?.[5]?.trim().toUpperCase() === "TRUE"

    // Waitlist: filter to rows that look like real wallet entries before
    // counting position, so the index matches what the user sees in the UI.
    const walletRows = waitlistRows.filter((row) => {
      const cell = row[1]?.trim().toLowerCase()
      return cell && cell.startsWith("0x")
    })

    const total = walletRows.length
    const waitlistIndex = walletRows.findIndex((row) => row[1]?.trim().toLowerCase() === address)
    const onWaitlist = waitlistIndex !== -1
    const position = onWaitlist ? waitlistIndex + 1 : null

    // Col F (index 5) = approved (promoted from waitlist to whitelist)
    const approved = onWaitlist
      ? walletRows[waitlistIndex]?.[5]?.trim().toUpperCase() === "TRUE"
      : false

    return NextResponse.json(
      { whitelisted, approved, onWaitlist, acceptedInvite, position, total },
      { status: 200 }
    )
  } catch (error) {
    console.error("Gate status error:", error)
    // Degrade gracefully — an unreachable sheet shouldn't block the UI,
    // so we return the "empty gate" state instead of a 5xx.
    return NextResponse.json(EMPTY_RESPONSE, { status: 200 })
  }
}
