import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Keep payload limits aligned with the client helper so we catch mismatches early.
const viemSchema = z
  .object({
    shortMessage: z.string().max(600).optional(),
    details: z.string().max(600).optional(),
    metaMessages: z.array(z.string().max(600)).max(10).optional(),
    rootCauseName: z.string().max(100).optional(),
    rootCauseMessage: z.string().max(600).optional(),
  })
  .strict()

const payloadSchema = z
  .object({
    message: z.string().min(1).max(2_100),
    name: z.string().min(1).max(100),
    stack: z.string().max(8_200).optional(),
    viem: viemSchema.optional(),
    context: z.record(z.unknown()).optional(),
    url: z.string().max(2_000).optional(),
    userAgent: z.string().max(500).optional(),
    sessionId: z.string().max(100).optional(),
    timestamp: z.number().int().nonnegative(),
  })
  .strict()

const MAX_BODY_BYTES = 32_000

export async function POST(request: NextRequest) {
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = payloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues.slice(0, 5) },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined

    // Structured single-line JSON so Vercel's log drain parses it cleanly into Groundcover.
    console.error(
      "[client-error] " +
        JSON.stringify({
          level: "error",
          source: "client",
          ip,
          ...payload,
        })
    )

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    // Never fail loudly — dropped reports are acceptable, crashed endpoints are not.
    console.error(
      "[client-error] endpoint crashed",
      err instanceof Error ? err.message : String(err)
    )
    return new NextResponse(null, { status: 204 })
  }
}
