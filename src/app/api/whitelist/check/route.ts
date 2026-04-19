import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSheetsClient } from "@/lib/google-sheets"
import { getWhitelistSheetCache, setWhitelistSheetCache } from "@/lib/waitlist-sheet-cache"
import { parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const WHITELIST_RANGE = "'Swap Whitelist'!A:G"
const querySchema = z.object({ address: walletAddressSchema })

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (!parsed.ok) return parsed.response
  const address = parsed.data.address

  try {
    let rows = getWhitelistSheetCache()
    if (!rows) {
      const { sheets, spreadsheetId } = await getSheetsClient()
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WHITELIST_RANGE })
      rows = (result.data.values ?? []) as string[][]
      setWhitelistSheetCache(rows)
    }

    const whitelisted = rows.some((row) => {
      const cell = row[0]?.trim().toLowerCase()
      return cell && cell === address
    })
    return NextResponse.json({ whitelisted }, { status: 200 })
  } catch (error) {
    console.error("Whitelist check error:", error)
    return NextResponse.json({ whitelisted: false }, { status: 200 })
  }
}
