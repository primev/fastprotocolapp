import { NextResponse } from "next/server"

const WHITELIST_RANGE = "'Swap Whitelist'!A:A"

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      return NextResponse.json({ addresses: [] }, { status: 200 })
    }

    let googleModule
    try {
      googleModule = await import("googleapis")
    } catch {
      return NextResponse.json({ addresses: [] }, { status: 200 })
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
      range: WHITELIST_RANGE,
    })

    const rows = (result.data.values ?? []) as string[][]
    const addresses = rows
      .map((row) => row[0]?.trim().toLowerCase())
      .filter((a): a is string => !!a && a.startsWith("0x"))

    return NextResponse.json({ addresses }, { status: 200 })
  } catch (error) {
    console.error("Whitelist list error:", error)
    return NextResponse.json({ addresses: [] }, { status: 200 })
  }
}
