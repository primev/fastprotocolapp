import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getSheetsClient } from "@/lib/google-sheets"
import {
  getWhitelistSheetCache,
  setWhitelistSheetCache,
  invalidateWhitelistSheetCache,
} from "@/lib/waitlist-sheet-cache"

// Swap Whitelist columns:
// A: address, B: listA, C: listB, D: listC, E: priority, F: acceptedInvite, G: swapCount
const WHITELIST_RANGE = "'Swap Whitelist'!A:G"
const WHITELIST_SHEET = "Swap Whitelist"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWhitelistRows(sheets: any, spreadsheetId: string): Promise<string[][]> {
  const cached = getWhitelistSheetCache()
  if (cached) return cached
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WHITELIST_RANGE })
  const rows = (result.data.values ?? []) as string[][]
  setWhitelistSheetCache(rows)
  return rows
}

/** Check whether a wallet has accepted their invite */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400 })
    }

    const { sheets, spreadsheetId } = await getSheetsClient()
    const rows = await fetchWhitelistRows(sheets, spreadsheetId)

    const normalizedInput = address.toLowerCase().trim()
    const row = rows.find((r) => r[0]?.trim().toLowerCase() === normalizedInput)
    const accepted = row?.[5]?.trim().toUpperCase() === "TRUE"

    return NextResponse.json({ accepted }, { status: 200 })
  } catch (error) {
    console.error("Accept invite check error:", error)
    return NextResponse.json({ accepted: false }, { status: 200 })
  }
}

/** Mark a wallet as having accepted their invite (sets col F = TRUE on Swap Whitelist) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet_address } = body

    if (!wallet_address || !isAddress(wallet_address)) {
      return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 })
    }

    const { sheets, spreadsheetId } = await getSheetsClient()
    const rows = await fetchWhitelistRows(sheets, spreadsheetId)

    const normalizedInput = wallet_address.toLowerCase().trim()
    const rowIndex = rows.findIndex((r) => r[0]?.trim().toLowerCase() === normalizedInput)

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Wallet not on whitelist" }, { status: 404 })
    }

    // Update col F (acceptedInvite) on the Swap Whitelist sheet
    const sheetRow = rowIndex + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${WHITELIST_SHEET}'!F${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["TRUE"]] },
    })

    invalidateWhitelistSheetCache()
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("Accept invite update error:", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
