import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getSheetsClient } from "@/lib/google-sheets"
import { getWaitlistSheetCache, setWaitlistSheetCache } from "@/lib/waitlist-sheet-cache"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"

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
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400 })
    }

    const rows = await fetchRows()
    const normalizedInput = address.toLowerCase().trim()

    const walletRows = rows.filter((row) => {
      const cell = row[1]?.trim().toLowerCase()
      return cell && cell.startsWith("0x")
    })

    const total = walletRows.length
    const index = walletRows.findIndex((row) => row[1]?.trim().toLowerCase() === normalizedInput)

    if (index === -1) {
      return NextResponse.json({ position: null, total }, { status: 200 })
    }

    return NextResponse.json({ position: index + 1, total }, { status: 200 })
  } catch (error) {
    console.error("Waitlist position error:", error)
    return NextResponse.json({ position: null, total: 0 }, { status: 200 })
  }
}
