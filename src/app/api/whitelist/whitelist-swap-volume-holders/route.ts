import { NextResponse } from "next/server"
import { getAnalyticsClient, AnalyticsClientError } from "@/lib/analytics/client"
import { getSheetsClient } from "@/lib/google-sheets"

const SHEET_NAME = "Swap Whitelist"
const SHEET_RANGE = `'${SHEET_NAME}'!A:A`

export async function GET() {
  try {
    const client = getAnalyticsClient()

    // Fetch all wallets with swap volume > 0 and connect to Sheets in parallel
    const [rows, { sheets, spreadsheetId }] = await Promise.all([
      client.execute("whitelist/all-swap-wallets"),
      getSheetsClient(),
    ])

    const wallets = rows.map((row) => String(row[0]).toLowerCase())

    // Read existing addresses from the Swap Whitelist sheet
    const sheetResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_RANGE,
    })
    const existingRows = (sheetResult.data.values ?? []) as string[][]
    const existingAddresses = new Set<string>()
    let hasHeader = false

    for (const row of existingRows) {
      const addr = row[0]?.trim().toLowerCase()
      if (addr === "address") {
        hasHeader = true
        continue
      }
      if (addr && addr.startsWith("0x")) existingAddresses.add(addr)
    }

    // Filter out duplicates
    const newWallets = wallets.filter((w) => !existingAddresses.has(w))

    // Write header if missing
    if (!hasHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["address"]] },
      })
    }

    // Append new addresses
    if (newWallets.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: SHEET_RANGE,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: newWallets.map((w) => [w]) },
      })
    }

    return NextResponse.json({
      success: true,
      totalWithVolume: wallets.length,
      added: newWallets.length,
      alreadyPresent: existingAddresses.size,
      skipped: wallets.length - newWallets.length,
    })
  } catch (error) {
    console.error("Error syncing whitelist-swap-volume-holders:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode || 500 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to sync whitelist-swap-volume-holders" },
      { status: 500 }
    )
  }
}
