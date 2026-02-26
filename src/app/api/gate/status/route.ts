import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getSheetsClient } from "@/lib/google-sheets"
import {
  getWaitlistSheetCache,
  setWaitlistSheetCache,
  getWhitelistSheetCache,
  setWhitelistSheetCache,
} from "@/lib/waitlist-sheet-cache"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"
// address(A), listA(B), listB(C), listC(D), priority(E), acceptedInvite(F), swapCount(G)
const WHITELIST_RANGE = "'Swap Whitelist'!A:G"

const EMPTY_RESPONSE = {
  whitelisted: false,
  approved: false,
  onWaitlist: false,
  acceptedInvite: false,
  position: null,
  total: 0,
}

async function fetchWaitlistRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: any,
  spreadsheetId: string
): Promise<string[][]> {
  const cached = getWaitlistSheetCache()
  if (cached) return cached

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: WAITLIST_RANGE,
  })
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

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: WHITELIST_RANGE,
  })
  const rows = (result.data.values ?? []) as string[][]
  setWhitelistSheetCache(rows)
  return rows
}

/**
 * Single consolidated endpoint that returns all gate status in one call.
 *
 * Replaces the need for separate calls to:
 *   /api/whitelist/list
 *   /api/waitlist/list
 *   /api/waitlist/position
 *   /api/waitlist/accept-invite (GET)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400 })
    }

    const { sheets, spreadsheetId } = await getSheetsClient()
    const normalized = address.toLowerCase().trim()

    // Fetch both sheets in parallel, using server-side caches
    const [waitlistRows, whitelistRows] = await Promise.all([
      fetchWaitlistRows(sheets, spreadsheetId),
      fetchWhitelistRows(sheets, spreadsheetId),
    ])

    // Check whitelist — col A = address, col F (index 5) = acceptedInvite
    const whitelistMatch = whitelistRows.find((row) => row[0]?.trim().toLowerCase() === normalized)
    const whitelisted = Boolean(whitelistMatch)
    const acceptedInvite = whitelistMatch?.[5]?.trim().toUpperCase() === "TRUE"

    // Check waitlist — filter to valid wallet rows for position counting
    const walletRows = waitlistRows.filter((row) => {
      const cell = row[1]?.trim().toLowerCase()
      return cell && cell.startsWith("0x")
    })

    const total = walletRows.length
    const waitlistIndex = walletRows.findIndex((row) => row[1]?.trim().toLowerCase() === normalized)
    const onWaitlist = waitlistIndex !== -1
    const position = onWaitlist ? waitlistIndex + 1 : null

    // Column F (index 5) = approved on waitlist (promoted from waitlist)
    const approved = onWaitlist
      ? walletRows[waitlistIndex]?.[5]?.trim().toUpperCase() === "TRUE"
      : false

    return NextResponse.json(
      { whitelisted, approved, onWaitlist, acceptedInvite, position, total },
      { status: 200 }
    )
  } catch (error) {
    console.error("Gate status error:", error)
    return NextResponse.json(EMPTY_RESPONSE, { status: 200 })
  }
}
