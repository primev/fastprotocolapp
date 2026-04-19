import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSheetsClient } from "@/lib/google-sheets"
import { getWaitlistSheetCache, setWaitlistSheetCache } from "@/lib/waitlist-sheet-cache"
import { parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"
const querySchema = z.object({ address: walletAddressSchema })

async function fetchRows(): Promise<string[][]> {
  const cached = getWaitlistSheetCache()
  if (cached) return cached
  const { sheets, spreadsheetId } = await getSheetsClient()
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WAITLIST_RANGE })
  const rows = (result.data.values ?? []) as string[][]
  setWaitlistSheetCache(rows)
  return rows
}

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (!parsed.ok) return parsed.response
  const address = parsed.data.address

  try {
    const rows = await fetchRows()

    // Strip header/blank rows so index + 1 matches the user-visible position.
    const walletRows = rows.filter((row) => {
      const cell = row[1]?.trim().toLowerCase()
      return cell && cell.startsWith("0x")
    })

    const total = walletRows.length
    const index = walletRows.findIndex((row) => row[1]?.trim().toLowerCase() === address)
    if (index === -1) return NextResponse.json({ position: null, total }, { status: 200 })
    return NextResponse.json({ position: index + 1, total }, { status: 200 })
  } catch (error) {
    console.error("Waitlist position error:", error)
    return NextResponse.json({ position: null, total: 0 }, { status: 200 })
  }
}
