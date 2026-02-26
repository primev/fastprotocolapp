import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getSheetsClient } from "@/lib/google-sheets"
import { getWhitelistSheetCache, setWhitelistSheetCache } from "@/lib/waitlist-sheet-cache"

const WHITELIST_RANGE = "'Swap Whitelist'!A:G"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400 })
    }

    let rows = getWhitelistSheetCache()

    if (!rows) {
      const { sheets, spreadsheetId } = await getSheetsClient()
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WHITELIST_RANGE })
      rows = (result.data.values ?? []) as string[][]
      setWhitelistSheetCache(rows)
    }

    const normalizedInput = address.toLowerCase().trim()
    const whitelisted = rows.some((row) => {
      const cell = row[0]?.trim().toLowerCase()
      return cell && cell === normalizedInput
    })

    return NextResponse.json({ whitelisted }, { status: 200 })
  } catch (error) {
    console.error("Whitelist check error:", error)
    return NextResponse.json({ whitelisted: false }, { status: 200 })
  }
}
