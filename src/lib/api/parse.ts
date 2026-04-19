import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"

// Small helpers for validating API inputs.
//
// These return a discriminated union so call sites don't have to know about
// `NextResponse` to narrow — `if (!parsed.ok) return parsed.response` is
// self-documenting and keeps the success path typed.
//
// We tried an earlier `T | NextResponse` shape that relied on
// `instanceof NextResponse` narrowing; now that `strictNullChecks: true` is on
// (see `tsconfig.json`), the discriminated-union form narrows cleanly and is
// the clearer contract. Either form is safe — migration happened to favour
// explicit `.ok` for readability.
//
// Usage:
//   const parsed = await parseJson(request, MySchema)
//   if (!parsed.ok) return parsed.response
//   // parsed.data is fully typed here — use `.foo`, `.bar` freely
//
// The `z.ZodType<T, z.ZodTypeDef, unknown>` signature forces the INPUT to
// `unknown` (exactly what we have off the wire) while leaving the OUTPUT `T`
// inferable, so `.transform()`-wrapped schemas like `walletAddressSchema`
// preserve their post-transform type.

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

function fail(error: z.ZodError): ParseResult<never> {
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "Invalid request",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    ),
  }
}

function fromResult<T>(result: z.SafeParseReturnType<unknown, T>): ParseResult<T> {
  return result.success ? { ok: true, data: result.data } : fail(result.error)
}

/**
 * Parse a JSON body against a Zod schema. Returns `{ ok: true, data }` on
 * success or `{ ok: false, response }` with a 400 when validation fails.
 */
export async function parseJson<T>(
  request: NextRequest,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }),
    }
  }
  return fromResult(schema.safeParse(raw))
}

/**
 * Parse `request.nextUrl.searchParams` against a schema. URL params arrive as
 * strings — pair this with `z.coerce.number()` / `z.coerce.boolean()` when the
 * downstream shape needs typed primitives.
 */
export function parseSearchParams<T>(
  request: NextRequest,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): ParseResult<T> {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries())
  return fromResult(schema.safeParse(entries))
}

/**
 * Parse a dynamic route segment (e.g. `[wallet_address]`) against a schema.
 * Next.js 15 gives params as a Promise — this helper awaits it first.
 */
export async function parseParams<T>(
  paramsPromise: Promise<Record<string, string | string[] | undefined>>,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): Promise<ParseResult<T>> {
  const raw = await paramsPromise
  return fromResult(schema.safeParse(raw))
}
