import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"

// Small helpers for validating API inputs.
//
// Why the shape `T | NextResponse`: we tried a discriminated union
// (`{ ok: true; data } | { ok: false; response }`) first, but our tsconfig
// runs with `strictNullChecks: false`, which drops the narrowing needed to
// access `.response` after `if (!parsed.ok)`. Returning `T | NextResponse`
// lets the caller narrow with `instanceof NextResponse`, which works under
// any strictness setting.
//
// Usage:
//   const parsed = await parseJson(request, MySchema)
//   if (parsed instanceof NextResponse) return parsed
//   // parsed is fully typed here — use `.foo`, `.bar` freely
//
// The `z.ZodType<T, z.ZodTypeDef, unknown>` signature forces the INPUT to
// `unknown` (exactly what we have off the wire) while leaving the OUTPUT `T`
// inferable, so `.transform()`-wrapped schemas like `walletAddressSchema`
// preserve their post-transform type.

function errorResponse(error: z.ZodError): NextResponse {
  return NextResponse.json(
    {
      error: "Invalid request",
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 400 }
  )
}

/**
 * Parse a JSON body against a Zod schema. Returns the parsed value, or a 400
 * `NextResponse` if validation fails.
 */
export async function parseJson<T>(
  request: NextRequest,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): Promise<T | NextResponse> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 })
  }
  const result = schema.safeParse(raw)
  return result.success ? result.data : errorResponse(result.error)
}

/**
 * Parse `request.nextUrl.searchParams` against a schema. URL params arrive as
 * strings — pair this with `z.coerce.number()` / `z.coerce.boolean()` when the
 * downstream shape needs typed primitives.
 */
export function parseSearchParams<T>(
  request: NextRequest,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T | NextResponse {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = schema.safeParse(entries)
  return result.success ? result.data : errorResponse(result.error)
}

/**
 * Parse a dynamic route segment (e.g. `[wallet_address]`) against a schema.
 * Next.js 15 gives params as a Promise — this helper awaits it first.
 */
export async function parseParams<T>(
  paramsPromise: Promise<Record<string, string | string[] | undefined>>,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): Promise<T | NextResponse> {
  const raw = await paramsPromise
  const result = schema.safeParse(raw)
  return result.success ? result.data : errorResponse(result.error)
}
