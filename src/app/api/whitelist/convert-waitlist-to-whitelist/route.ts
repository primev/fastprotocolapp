import { NextResponse } from "next/server"
import { getSheetsClient } from "@/lib/google-sheets"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"
const WHITELIST_SHEET = "Swap Whitelist"
const WHITELIST_RANGE = `'${WHITELIST_SHEET}'!A:A`

export async function GET() {
  try {
    const { sheets, spreadsheetId } = await getSheetsClient()

    // Read waitlist and whitelist in parallel
    const [waitlistResult, whitelistResult] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: WAITLIST_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: WHITELIST_RANGE }),
    ])

    // Extract waitlist addresses (column B)
    const waitlistRows = (waitlistResult.data.values ?? []) as string[][]
    const waitlistAddresses = waitlistRows
      .map((row) => row[1]?.trim().toLowerCase())
      .filter((a): a is string => !!a && a.startsWith("0x"))

    // Extract existing whitelist addresses (column A)
    const whitelistRows = (whitelistResult.data.values ?? []) as string[][]
    const existingAddresses = new Set<string>()
    let hasHeader = false

    for (const row of whitelistRows) {
      const addr = row[0]?.trim().toLowerCase()
      if (addr === "address") {
        hasHeader = true
        continue
      }
      if (addr && addr.startsWith("0x")) existingAddresses.add(addr)
    }

    // Deduplicate: only addresses not already in the whitelist
    const seen = new Set<string>()
    const newAddresses: string[] = []
    for (const addr of waitlistAddresses) {
      if (!existingAddresses.has(addr) && !seen.has(addr)) {
        seen.add(addr)
        newAddresses.push(addr)
      }
    }

    // Write header if missing
    if (!hasHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${WHITELIST_SHEET}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["address"]] },
      })
    }

    // Append new addresses
    if (newAddresses.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: WHITELIST_RANGE,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: newAddresses.map((w) => [w]) },
      })
    }

    return NextResponse.json({
      success: true,
      waitlistTotal: waitlistAddresses.length,
      added: newAddresses.length,
      alreadyPresent: waitlistAddresses.length - newAddresses.length,
    })
  } catch (error) {
    console.error("Error converting waitlist to whitelist:", error)
    return NextResponse.json(
      { success: false, error: "Failed to convert waitlist to whitelist" },
      { status: 500 }
    )
  }
}
