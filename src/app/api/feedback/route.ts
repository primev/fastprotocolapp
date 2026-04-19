import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJson } from "@/lib/api/parse"
import { walletAddressSchema, txHashSchema } from "@/lib/api/schemas"

// Body schema lives here (not in the shared schemas file) because the shape
// is route-specific — only the feedback sheet consumes these five columns.
//
// Note: an older version of this route had a mismatch between the TS type
// (`"yes" | "average" | "no"`) and the runtime check (`"slow" | "normal" |
// "fast"`). Zod eliminates the duplication.
const feedbackSchema = z.object({
  timestamp: z.string().min(1, "timestamp is required"),
  wallet_address: walletAddressSchema,
  tx_type: z.string().min(1, "tx_type is required"),
  status: z.enum(["slow", "normal", "fast"]),
  txhash: txHashSchema.optional(),
})

export async function POST(request: NextRequest) {
  const body = await parseJson(request, feedbackSchema)
  if (!body.ok) return body.response

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      console.error("Google Sheets configuration missing")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    let googleModule
    try {
      googleModule = await import("googleapis")
    } catch {
      console.error("googleapis package not installed. Run: npm install googleapis")
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

    // Sheet columns in order: timestamp, wallet_address, tx_type, status, txhash
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'Speed Feedback'!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            body.data.timestamp,
            body.data.wallet_address,
            body.data.tx_type,
            body.data.status,
            body.data.txhash ?? "",
          ],
        ],
      },
    })

    return NextResponse.json(
      { success: true, message: "Feedback submitted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error submitting feedback:", error)
    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
      }
      if (error.message.includes("spreadsheet")) {
        return NextResponse.json(
          { error: "Spreadsheet not found or inaccessible" },
          { status: 500 }
        )
      }
    }
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}
