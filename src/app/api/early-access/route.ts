import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getSheetsClient } from "@/lib/google-sheets"
import {
  getWaitlistSheetCache,
  setWaitlistSheetCache,
  invalidateWaitlistSheetCache,
  getWhitelistSheetCache,
  setWhitelistSheetCache,
} from "@/lib/waitlist-sheet-cache"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"
const WHITELIST_RANGE = "'Swap Whitelist'!A:G"

interface EarlyAccessPayload {
  wallet_address: string
  x_handle: string
  discord_handle: string
  email: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWaitlistRows(sheets: any, spreadsheetId: string): Promise<string[][]> {
  const cached = getWaitlistSheetCache()
  if (cached) return cached
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WAITLIST_RANGE })
  const rows = (result.data.values ?? []) as string[][]
  setWaitlistSheetCache(rows)
  return rows
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWhitelistRows(sheets: any, spreadsheetId: string): Promise<string[][]> {
  const cached = getWhitelistSheetCache()
  if (cached) return cached
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: WHITELIST_RANGE })
  const rows = (result.data.values ?? []) as string[][]
  setWhitelistSheetCache(rows)
  return rows
}

export async function POST(request: NextRequest) {
  try {
    const body: EarlyAccessPayload = await request.json()

    const { wallet_address, x_handle, discord_handle, email } = body

    if (!wallet_address?.trim()) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })
    }
    if (!isAddress(wallet_address.trim())) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
    }
    if (!x_handle?.trim()) {
      return NextResponse.json({ error: "X handle is required" }, { status: 400 })
    }
    if (!discord_handle?.trim()) {
      return NextResponse.json({ error: "Discord handle is required" }, { status: 400 })
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    const { sheets, spreadsheetId } = await getSheetsClient()
    const wallet = wallet_address.trim()
    const normalized = wallet.toLowerCase().trim()

    // Fetch both sheets in parallel, using server-side caches
    const [waitlistRows, whitelistRows] = await Promise.all([
      fetchWaitlistRows(sheets, spreadsheetId).catch(() => [] as string[][]),
      fetchWhitelistRows(sheets, spreadsheetId).catch(() => [] as string[][]),
    ])

    const alreadyOnWaitlist = waitlistRows.some(
      (row) => row[1]?.trim().toLowerCase() === normalized
    )
    const hasAccess = whitelistRows.some((row) => row[0]?.trim().toLowerCase() === normalized)

    if (alreadyOnWaitlist) {
      return NextResponse.json(
        { ok: true, alreadyOnWaitlist: true, approved: hasAccess },
        { status: 200 }
      )
    }

    const timestamp = new Date().toISOString()

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: WAITLIST_RANGE,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            timestamp,
            wallet,
            x_handle.trim(),
            discord_handle.trim(),
            email.trim(),
            hasAccess ? "TRUE" : "FALSE",
          ],
        ],
      },
    })

    // Bust the server cache so the next status fetch reflects the new row
    invalidateWaitlistSheetCache()

    return NextResponse.json({ ok: true, approved: hasAccess }, { status: 200 })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error("Early access submit error:", err)
    return NextResponse.json(
      {
        error:
          err.message?.includes("spreadsheet") ||
          err.message?.includes("Sheet") ||
          err.message?.includes("404")
            ? "Google Sheet configuration error. Check that GOOGLE_SHEETS_ID and sheet names are correct."
            : (err.message ?? "Failed to submit. Please try again."),
      },
      { status: 500 }
    )
  }
}
