import { NextResponse } from "next/server"
import { getSheetsClient } from "@/lib/google-sheets"
import { getWaitlistSheetCache, setWaitlistSheetCache } from "@/lib/waitlist-sheet-cache"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"

export async function GET() {
  try {
    let rows = getWaitlistSheetCache()

    if (!rows) {
      const { sheets, spreadsheetId } = await getSheetsClient()
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WAITLIST_RANGE })
      rows = (result.data.values ?? []) as string[][]
      setWaitlistSheetCache(rows)
    }

    const addresses = rows
      .map((row) => row[1]?.trim().toLowerCase())
      .filter((a): a is string => !!a && a.startsWith("0x"))

    return NextResponse.json({ addresses }, { status: 200 })
  } catch (error) {
    console.error("Waitlist list error:", error)
    return NextResponse.json({ addresses: [] }, { status: 200 })
  }
}
