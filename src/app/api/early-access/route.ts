import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"

const WAITLIST_RANGE = "'Swap Waitlist'!A:F"
const WHITELIST_RANGE = "'Swap Whitelist'!A:A"

interface EarlyAccessPayload {
  wallet_address: string
  x_handle: string
  discord_handle: string
  email: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function checkWhitelist(
  sheets: {
    spreadsheets: { values: { get: (opts: unknown) => Promise<{ data: { values?: string[][] } }> } }
  },
  spreadsheetId: string,
  address: string
): Promise<boolean> {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: WHITELIST_RANGE,
  })
  const rows = (result.data.values ?? []) as string[][]
  const normalized = address.toLowerCase().trim()
  return rows.some((row) => {
    const cell = row[0]?.trim().toLowerCase()
    return cell && cell === normalized
  })
}

async function isOnWaitlist(
  sheets: {
    spreadsheets: { values: { get: (opts: unknown) => Promise<{ data: { values?: string[][] } }> } }
  },
  spreadsheetId: string,
  address: string
): Promise<boolean> {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: WAITLIST_RANGE,
  })
  const rows = (result.data.values ?? []) as string[][]
  const normalized = address.toLowerCase().trim()
  return rows.some((row) => {
    const cell = row[1]?.trim().toLowerCase()
    return cell && cell === normalized
  })
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

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      console.error("Google Sheets configuration missing for early access")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    let googleModule
    try {
      googleModule = await import("googleapis")
    } catch {
      return NextResponse.json(
        { error: "Server configuration error: googleapis not installed" },
        { status: 500 }
      )
    }

    const { google } = googleModule
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })
    const wallet = wallet_address.trim()

    const [alreadyOnWaitlist, hasAccess] = await Promise.all([
      isOnWaitlist(sheets, spreadsheetId, wallet).catch(() => false),
      checkWhitelist(sheets, spreadsheetId, wallet).catch(() => false),
    ])

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
