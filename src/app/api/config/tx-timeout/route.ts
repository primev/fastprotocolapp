import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

const DEFAULT_TIMEOUT_MS = 60000

export async function GET() {
  try {
    const timeoutMs = await get<number>("tx_confirmation_timeout_ms")
    return NextResponse.json(
      {
        timeoutMs: typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("[tx-timeout] Edge Config read failed:", error)
    return NextResponse.json(
      { timeoutMs: DEFAULT_TIMEOUT_MS },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
