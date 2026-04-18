import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSheetsClient } from "@/lib/google-sheets"
import {
  getWhitelistSheetCache,
  setWhitelistSheetCache,
  invalidateWhitelistSheetCache,
} from "@/lib/waitlist-sheet-cache"
import { parseJson, parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

// Swap Whitelist columns:
// A: address, B: listA, C: listB, D: listC, E: priority, F: acceptedInvite, G: swapCount
const WHITELIST_RANGE = "'Swap Whitelist'!A:G"
const WHITELIST_SHEET = "Swap Whitelist"

const querySchema = z.object({ address: walletAddressSchema })
const bodySchema = z.object({ wallet_address: walletAddressSchema })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWhitelistRows(sheets: any, spreadsheetId: string): Promise<string[][]> {
  const cached = getWhitelistSheetCache()
  if (cached) return cached
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WHITELIST_RANGE })
  const rows = (result.data.values ?? []) as string[][]
  setWhitelistSheetCache(rows)
  return rows
}

/** Check whether a wallet has accepted their invite. */
export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const address = parsed.address // already lower-cased

  try {
    const { sheets, spreadsheetId } = await getSheetsClient()
    const rows = await fetchWhitelistRows(sheets, spreadsheetId)

    const row = rows.find((r) => r[0]?.trim().toLowerCase() === address)
    const accepted = row?.[5]?.trim().toUpperCase() === "TRUE"

    return NextResponse.json({ accepted }, { status: 200 })
  } catch (error) {
    console.error("Accept invite check error:", error)
    // Fail soft — the accept-invite banner can re-resolve later.
    return NextResponse.json({ accepted: false }, { status: 200 })
  }
}

/** Mark a wallet as having accepted their invite (sets col F = TRUE on Swap Whitelist). */
export async function POST(request: NextRequest) {
  const body = await parseJson(request, bodySchema)
  if (body instanceof NextResponse) return body
  const address = body.wallet_address

  try {
    const { sheets, spreadsheetId } = await getSheetsClient()
    const rows = await fetchWhitelistRows(sheets, spreadsheetId)

    const rowIndex = rows.findIndex((r) => r[0]?.trim().toLowerCase() === address)
    if (rowIndex === -1) {
      return NextResponse.json({ error: "Wallet not on whitelist" }, { status: 404 })
    }

    // Google Sheets rows are 1-indexed.
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
