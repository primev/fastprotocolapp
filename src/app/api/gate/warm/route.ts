import { NextResponse } from "next/server"
import { getSheetsClient } from "@/lib/google-sheets"
import {
  getWaitlistSheetCache,
  setWaitlistSheetCache,
  getWhitelistSheetCache,
  setWhitelistSheetCache,
} from "@/lib/waitlist-sheet-cache"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"
const WHITELIST_RANGE = "'Swap Whitelist'!A:G"

/**
 * Primes the server-side sheet caches so that the next /api/gate/status
 * call is a fast local lookup instead of a Google Sheets round-trip.
 *
 * Fire-and-forget from the landing page on mount.
 */
export async function GET() {
  try {
    // Both caches already warm — nothing to do
    if (getWaitlistSheetCache() && getWhitelistSheetCache()) {
      return NextResponse.json({ ok: true, cached: true })
    }

    const { sheets, spreadsheetId } = await getSheetsClient()

    const fetches: Promise<void>[] = []

    if (!getWaitlistSheetCache()) {
      fetches.push(
        sheets.spreadsheets.values
          .get({ spreadsheetId, range: WAITLIST_RANGE })
          .then((r: { data: { values?: string[][] } }) =>
            setWaitlistSheetCache((r.data.values ?? []) as string[][])
          )
      )
    }

    if (!getWhitelistSheetCache()) {
      fetches.push(
        sheets.spreadsheets.values
          .get({ spreadsheetId, range: WHITELIST_RANGE })
          .then((r: { data: { values?: string[][] } }) =>
            setWhitelistSheetCache((r.data.values ?? []) as string[][])
          )
      )
    }

    await Promise.all(fetches)
    return NextResponse.json({ ok: true, cached: false })
  } catch (error) {
    console.error("Gate warm error:", error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
