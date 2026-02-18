import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"

const WAITLIST_RANGE = "'Swap Waitlist'!A:F"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400 })
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      return NextResponse.json({ onWaitlist: false }, { status: 200 })
    }

    let googleModule
    try {
      googleModule = await import("googleapis")
    } catch {
      return NextResponse.json({ onWaitlist: false }, { status: 200 })
    }

    const { google } = googleModule
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: WAITLIST_RANGE,
    })

    const rows = (result.data.values ?? []) as string[][]
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
