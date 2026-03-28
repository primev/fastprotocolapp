import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

/** Redirect old ?time= URLs to clean /api/og/preconfirm/[time] path */
export async function GET(request: NextRequest) {
  const raw = parseFloat(request.nextUrl.searchParams.get("time") || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"
  return NextResponse.redirect(
    new URL(`/api/og/preconfirm/${time}`, request.url),
    301
  )
}
