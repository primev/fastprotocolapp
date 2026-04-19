import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseSearchParams } from "@/lib/api/parse"

export const runtime = "edge"

// `time` is a preconfirm duration in seconds. Default 0.4s matches the
// common happy-path value; we clamp to [0, 999] to bound the character
// length that ends up in the OG image.
const querySchema = z.object({
  time: z.coerce.number().min(0).max(999).default(0.4),
})

/** Redirect old ?time= URLs to clean /api/og/preconfirm/[time] path */
export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  // Parse failure falls back to the default rather than bubbling a 400 —
  // this is a redirect for OG crawlers, a 400 would ruin the social card.
  const time = (parsed instanceof NextResponse ? 0.4 : parsed.time).toFixed(1)
  return NextResponse.redirect(new URL(`/api/og/preconfirm/${time}`, request.url), 301)
}
