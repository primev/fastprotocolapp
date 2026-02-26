import { NextResponse } from "next/server"
import { getAnalyticsClient, AnalyticsClientError } from "@/lib/analytics/client"
import { getSheetsClient } from "@/lib/google-sheets"
import { invalidateWhitelistSheetCache } from "@/lib/waitlist-sheet-cache"

const LIMIT = 100
const SHEET_NAME = "Swap Whitelist"
// const SHEET_NAME = "testing-whitelist"
const SHEET_RANGE = `'${SHEET_NAME}'!A:G`
const BACKUP_SHEET_NAME = "Swap Whitelist Master Backup"
const BACKUP_RANGE = `'${BACKUP_SHEET_NAME}'!A:G`
const HEADERS = ["address", "listA", "listB", "listC", "priority", "acceptedInvite", "swapCount"]

interface WhitelistEntry {
  address: string
  listA: boolean
  listB: boolean
  listC: boolean
  priority: boolean
}

async function backupCurrentSheet(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>["sheets"],
  spreadsheetId: string
): Promise<void> {
  // Read all current data from the target sheet
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: SHEET_RANGE,
  })
  const currentData = (result.data.values ?? []) as string[][]

  // Clear the backup sheet, then write the current data
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: BACKUP_RANGE,
  })

  if (currentData.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${BACKUP_SHEET_NAME}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: currentData },
    })
  }
}

async function fetchSheetState(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>["sheets"],
  spreadsheetId: string
): Promise<{ existingAddresses: Set<string>; hasHeader: boolean }> {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: SHEET_RANGE,
  })
  const rows = (result.data.values ?? []) as string[][]
  const existingAddresses = new Set<string>()
  const hasHeader = rows.length > 0 && rows[0][0]?.trim().toLowerCase() === "address"

  for (const row of rows) {
    const addr = row[0]?.trim().toLowerCase()
    if (addr && addr.startsWith("0x")) existingAddresses.add(addr)
  }

  return { existingAddresses, hasHeader }
}

function toRow(w: WhitelistEntry): string[] {
  return [
    w.address,
    w.listA ? "TRUE" : "FALSE",
    w.listB ? "TRUE" : "FALSE",
    w.listC ? "TRUE" : "FALSE",
    w.priority ? "TRUE" : "FALSE",
    "FALSE", // acceptedInvite — always FALSE on initial insert
    "0", // swapCount — starts at zero, updated separately
  ]
}

export async function GET() {
  try {
    const client = getAnalyticsClient()

    // Step 1: run analytics queries + connect to Sheets in parallel
    const [listARows, listBRows, listCRows, { sheets, spreadsheetId }] = await Promise.all([
      client.execute("whitelist/top-by-volume", { limit: LIMIT }),
      client.execute("whitelist/top-by-count", { limit: LIMIT }),
      client.execute("whitelist/top-by-recent-count", { limit: LIMIT }),
      getSheetsClient(),
    ])

    // Step 2: build wallet sets
    const walletsA = new Set(listARows.map((row) => String(row[0]).toLowerCase()))
    const walletsB = new Set(listBRows.map((row) => String(row[0]).toLowerCase()))
    const walletsC = new Set(listCRows.map((row) => String(row[0]).toLowerCase()))

    // Step 3: build the generated whitelist (no swapCount — starts at 0 in sheet)
    const allWallets = new Set([...walletsA, ...walletsB, ...walletsC])
    const wallets: WhitelistEntry[] = []
    let priorityCount = 0

    for (const address of allWallets) {
      const listA = walletsA.has(address)
      const listB = walletsB.has(address)
      const listC = walletsC.has(address)
      const listCount = [listA, listB, listC].filter(Boolean).length
      const priority = listCount >= 2

      if (priority) priorityCount++
      wallets.push({ address, listA, listB, listC, priority })
    }

    // Sort: priority wallets first, then alphabetical
    wallets.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1
      return a.address.localeCompare(b.address)
    })

    // Step 4: read existing sheet state
    const { existingAddresses, hasHeader } = await fetchSheetState(sheets, spreadsheetId)
    const newEntries = wallets.filter((w) => !existingAddresses.has(w.address))

    // Step 5: backup current sheet state before modifying
    await backupCurrentSheet(sheets, spreadsheetId)

    // Step 6: write header if missing, then append new rows
    if (!hasHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [HEADERS] },
      })
    }

    if (newEntries.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: SHEET_RANGE,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: newEntries.map(toRow) },
      })
      // Bust the cache so subsequent whitelist checks reflect the new rows
      invalidateWhitelistSheetCache()
    }

    return NextResponse.json({
      success: true,
      total: wallets.length,
      priorityCount,
      added: newEntries.length,
      skipped: wallets.length - newEntries.length,
      newEntries,
    })
  } catch (error) {
    console.error("Error generating whitelist:", error)

    if (error instanceof AnalyticsClientError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode || 500 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to generate whitelist" },
      { status: 500 }
    )
  }
}
