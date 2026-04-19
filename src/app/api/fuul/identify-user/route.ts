import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJson } from "@/lib/api/parse"

const FUUL_API_URL = "https://api.fuul.xyz/api/v1/events"

// Fuul accepts three identifier types, but only evm_address is in use today.
// We still accept all three so a future wiring change doesn't need a schema
// migration — just a codepath addition.
const identifyUserSchema = z.object({
  identifier: z.string().min(1, "identifier is required"),
  identifierType: z.enum(["evm_address", "solana_address", "xrpl_address"]),
  trackingId: z.string().min(1, "trackingId is required"),
  accountChainId: z.number().int().optional(),
})

export async function POST(request: NextRequest) {
  const body = await parseJson(request, identifyUserSchema)
  if (!body.ok) return body.response

  try {
    const fuulApiKey = process.env.FUUL_API_KEY
    if (!fuulApiKey) {
      console.error("FUUL_API_KEY not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fuulPayload: any = {
      metadata: { tracking_id: body.data.trackingId },
      name: "connect_wallet",
      user: {
        identifier: body.data.identifier,
        // Fuul's field name is snake_case; we translate here so the client
        // contract stays camelCase throughout the app.
        identifier_type: body.data.identifierType,
      },
    }
    if (body.data.accountChainId !== undefined) {
      fuulPayload.account_chain_id = body.data.accountChainId
    }

    const response = await fetch(FUUL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${fuulApiKey}` },
      body: JSON.stringify(fuulPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Fuul API error:", response.status, errorText)
      return NextResponse.json(
        { error: "Failed to identify user with Fuul", details: errorText },
        { status: response.status }
      )
    }

    // Fuul returns 204 for success — we normalize to a JSON success shape
    // so clients don't need to special-case empty bodies.
    if (response.status === 204 || !response.body) {
      return NextResponse.json({ success: true })
    }

    try {
      const data = await response.json()
      return NextResponse.json({ success: true, data }, { status: 200 })
    } catch {
      console.warn("Fuul API returned non-JSON response, but status was OK")
      return NextResponse.json({ success: true }, { status: 200 })
    }
  } catch (error) {
    console.error("Error identifying user with Fuul:", error)
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Failed to identify user", details: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: "Failed to identify user" }, { status: 500 })
  }
}
