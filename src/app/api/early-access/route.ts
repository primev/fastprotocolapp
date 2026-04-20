import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSheetsClient } from "@/lib/google-sheets"
import {
  getWaitlistSheetCache,
  setWaitlistSheetCache,
  invalidateWaitlistSheetCache,
  getWhitelistSheetCache,
  setWhitelistSheetCache,
} from "@/lib/waitlist-sheet-cache"
import { parseJson } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const WAITLIST_RANGE = "'Swap Waitlist'!A:G"
const WHITELIST_RANGE = "'Swap Whitelist'!A:G"

// Zod replaces the earlier chain of imperative nullish checks. Contact
// methods are optional individually, but the `.refine` below enforces that
// at least ONE is provided — matches the main-branch semantics (users can
// join with any of X / Discord / email, not all three).
//
// `trim()` runs before length / format validation so whitespace-only input
// is treated as absent.
const earlyAccessSchema = z
  .object({
    wallet_address: walletAddressSchema,
    x_handle: z.string().trim().optional().default(""),
    discord_handle: z.string().trim().optional().default(""),
    email: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email address"),
  })
  .refine(
    (v) => v.x_handle !== "" || v.discord_handle !== "" || v.email !== "",
    "At least one contact method is required (X, Discord, or email)"
  )

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
  const body = await parseJson(request, earlyAccessSchema)
  if (!body.ok) return body.response

  try {
    const { sheets, spreadsheetId } = await getSheetsClient()
    const wallet = body.data.wallet_address // already lower-cased by walletAddressSchema

    const [waitlistRows, whitelistRows] = await Promise.all([
      fetchWaitlistRows(sheets, spreadsheetId).catch(() => [] as string[][]),
      fetchWhitelistRows(sheets, spreadsheetId).catch(() => [] as string[][]),
    ])

    const alreadyOnWaitlist = waitlistRows.some((row) => row[1]?.trim().toLowerCase() === wallet)
    const hasAccess = whitelistRows.some((row) => row[0]?.trim().toLowerCase() === wallet)

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
            body.data.x_handle,
            body.data.discord_handle,
            body.data.email,
            hasAccess ? "TRUE" : "FALSE",
          ],
        ],
      },
    })

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
