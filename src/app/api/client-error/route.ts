import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/env/server"

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

type ClientErrorPayload = z.infer<typeof payloadSchema>

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

    // Primary sink: Vercel runtime logs. Structured single-line JSON so it parses
    // cleanly in Vercel's log viewer and any downstream log drain (Groundcover,
    // Datadog, etc.).
    console.error(
      "[client-error] " +
        JSON.stringify({
          level: "error",
          source: "client",
          ip,
          ...payload,
        })
    )

    // Optional direct OTLP forwarding to Groundcover. Fire-and-forget so the
    // response stays fast; Vercel logs remain the source of truth.
    if (env.GROUNDCOVER_OTLP_ENDPOINT && env.GROUNDCOVER_API_KEY) {
      void forwardToGroundcover(payload, env.GROUNDCOVER_OTLP_ENDPOINT, env.GROUNDCOVER_API_KEY)
    }

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

async function forwardToGroundcover(
  payload: ClientErrorPayload,
  endpoint: string,
  apiKey: string
): Promise<void> {
  try {
    const timeUnixNano = String(BigInt(payload.timestamp) * 1_000_000n)
    const attributes = [
      attr("error.name", payload.name),
      attr("error.source", "client"),
      attr("service.name", "fastprotocolapp"),
      ...(payload.context?.source
        ? [attr("client_error.source", String(payload.context.source))]
        : []),
      ...(payload.url ? [attr("url.full", payload.url)] : []),
      ...(payload.userAgent ? [attr("user_agent.original", payload.userAgent)] : []),
      ...(payload.sessionId ? [attr("session.id", payload.sessionId)] : []),
      ...(payload.stack ? [attr("exception.stacktrace", payload.stack)] : []),
      ...(payload.viem?.shortMessage
        ? [attr("viem.short_message", payload.viem.shortMessage)]
        : []),
      ...(payload.viem?.rootCauseName
        ? [attr("viem.root_cause_name", payload.viem.rootCauseName)]
        : []),
      ...(payload.viem?.rootCauseMessage
        ? [attr("viem.root_cause_message", payload.viem.rootCauseMessage)]
        : []),
      ...Object.entries(payload.context ?? {})
        .filter(([k]) => k !== "source")
        .slice(0, 20)
        .map(([k, v]) => attr(`client_error.ctx.${k}`, stringifyAttr(v))),
    ]

    const body = {
      resourceLogs: [
        {
          resource: {
            attributes: [attr("service.name", "fastprotocolapp")],
          },
          scopeLogs: [
            {
              scope: { name: "client-error" },
              logRecords: [
                {
                  timeUnixNano,
                  severityNumber: 17, // ERROR
                  severityText: "ERROR",
                  body: { stringValue: payload.message },
                  attributes,
                },
              ],
            },
          ],
        },
      ],
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2_500)
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    console.error(
      "[client-error] Groundcover forward failed",
      err instanceof Error ? err.message : String(err)
    )
  }
}

function attr(key: string, value: string) {
  return { key, value: { stringValue: value } }
}

function stringifyAttr(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v.slice(0, 500)
  try {
    return JSON.stringify(v).slice(0, 500)
  } catch {
    return String(v).slice(0, 500)
  }
}
