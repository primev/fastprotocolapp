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

    const count = rows.filter((row) => {
      const cell = row[1]?.trim().toLowerCase()
      return cell && cell.startsWith("0x")
    }).length

    return NextResponse.json(
      { count },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      }
    )
  } catch (error) {
    console.error("Waitlist count error:", error)
    return NextResponse.json({ count: 0 }, { status: 200 })
  }
}
