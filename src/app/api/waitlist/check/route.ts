import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSheetsClient } from "@/lib/google-sheets"
import { getWaitlistSheetCache, setWaitlistSheetCache } from "@/lib/waitlist-sheet-cache"
import { parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"
const querySchema = z.object({ address: walletAddressSchema })

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (!parsed.ok) return parsed.response
  const address = parsed.data.address // already lower-cased

  try {
    let rows = getWaitlistSheetCache()
    if (!rows) {
      const { sheets, spreadsheetId } = await getSheetsClient()
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WAITLIST_RANGE })
      rows = (result.data.values ?? []) as string[][]
      setWaitlistSheetCache(rows)
    }

    const match = rows.find((row) => {
      const cell = row[1]?.trim().toLowerCase()
      return cell && cell === address
    })
    if (!match) return NextResponse.json({ onWaitlist: false }, { status: 200 })

    // Col F (index 5) carries approved-for-whitelist. The legacy sheet used
    // both "TRUE" and "1" as truthy values — keep both checks for back-compat.
    const hasAccess = match[5]?.toString().toUpperCase() === "TRUE" || match[5]?.toString() === "1"
    return NextResponse.json({ onWaitlist: true, hasAccess }, { status: 200 })
  } catch (error) {
    console.error("Waitlist check error:", error)
    return NextResponse.json({ onWaitlist: false }, { status: 200 })
  }
}
