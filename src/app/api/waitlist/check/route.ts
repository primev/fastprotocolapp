import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getSheetsClient } from "@/lib/google-sheets"
import { getWaitlistSheetCache, setWaitlistSheetCache } from "@/lib/waitlist-sheet-cache"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400 })
    }

    let rows = getWaitlistSheetCache()

    if (!rows) {
      const { sheets, spreadsheetId } = await getSheetsClient()
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WAITLIST_RANGE })
      rows = (result.data.values ?? []) as string[][]
      setWaitlistSheetCache(rows)
    }

    const normalizedInput = address.toLowerCase().trim()

    const match = rows.find((row) => {
      const cell = row[1]?.trim().toLowerCase()
      return cell && cell === normalizedInput
    })

    if (!match) {
      return NextResponse.json({ onWaitlist: false }, { status: 200 })
    }

    const hasAccess = match[5]?.toString().toUpperCase() === "TRUE" || match[5]?.toString() === "1"

    return NextResponse.json({ onWaitlist: true, hasAccess }, { status: 200 })
  } catch (error) {
    console.error("Waitlist check error:", error)
    return NextResponse.json({ onWaitlist: false }, { status: 200 })
  }
}
