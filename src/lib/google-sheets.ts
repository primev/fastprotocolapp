/**
 * Shared Google Sheets client.
 *
 * Caches the googleapis module import and JWT auth instance so
 * every API route reuses the same authorised client instead of
 * re-creating it on every request.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sheets: any = null
let _spreadsheetId: string | null = null

export async function getSheetsClient(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: any
  spreadsheetId: string
}> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
    throw new Error("Google Sheets configuration missing")
  }

  if (_sheets && _spreadsheetId === spreadsheetId) {
    return { sheets: _sheets, spreadsheetId }
  }

  const { google } = await import("googleapis")
  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })

  _sheets = google.sheets({ version: "v4", auth })
  _spreadsheetId = spreadsheetId

  return { sheets: _sheets, spreadsheetId }
}
