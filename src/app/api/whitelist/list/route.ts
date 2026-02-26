import { NextResponse } from "next/server"
import { getSheetsClient } from "@/lib/google-sheets"
import { getWhitelistSheetCache, setWhitelistSheetCache } from "@/lib/waitlist-sheet-cache"

const WHITELIST_RANGE = "'Swap Whitelist'!A:G"

export async function GET() {
  try {
    let rows = getWhitelistSheetCache()

    if (!rows) {
      const { sheets, spreadsheetId } = await getSheetsClient()
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WHITELIST_RANGE })
      rows = (result.data.values ?? []) as string[][]
      setWhitelistSheetCache(rows)
    }

    const addresses = rows
      .map((row) => row[0]?.trim().toLowerCase())
      .filter((a): a is string => !!a && a.startsWith("0x"))

    return NextResponse.json({ addresses }, { status: 200 })
  } catch (error) {
    console.error("Whitelist list error:", error)
    return NextResponse.json({ addresses: [] }, { status: 200 })
  }
}
