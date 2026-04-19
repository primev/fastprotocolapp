# API routes

## Layout

Routes live under `src/app/api/<name>/route.ts`. Each file exports HTTP-method-named async functions.

Existing endpoints (see `agent_docs/architecture.md` for the full list):

`analytics`, `barter`, `config`, `cron`, `early-access`, `fast-tx-status`,
`fastswap`, `fastswap-miles`, `feedback`, `fuul`, `gate`, `hyperliquid`, `og`,
`token-price`, `tokens`, `transaction-status`, `user-community-activity`,
`user-onboarding`, `users`, `waitlist`, `whitelist`.

## Pattern — always use the Zod helpers in `@/lib/api`

```ts
// src/app/api/example/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/env/server"
import { parseJson, parseParams, parseSearchParams } from "@/lib/api/parse"
import { walletAddressSchema, txHashSchema } from "@/lib/api/schemas"

const paramsSchema = z.object({ id: walletAddressSchema })
const bodySchema = z.object({ txhash: txHashSchema, status: z.enum(["ok", "err"]) })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const p = await parseParams(params, paramsSchema)
  if (!p.ok) return p.response

  const body = await parseJson(request, bodySchema)
  if (!body.ok) return body.response

  // `p.data.id` and `body.data` are fully typed here — p.data.id is already lower-cased.
  return NextResponse.json({ ok: true, id: p.data.id })
}
```

### Return shape — discriminated union

Parse helpers return `{ ok: true; data } | { ok: false; response }`. Narrow
with `if (!parsed.ok) return parsed.response`, then use `parsed.data`. This
shape requires `strictNullChecks: true` (which this repo has since the
`strictNullChecks` flip).

## Rules

1. **Validate every caller input with Zod** — body, search params, dynamic
   segments. Shared primitives live in `@/lib/api/schemas`; compose
   route-specific shapes next to the handler.
2. Return JSON via `NextResponse.json(...)`; set status explicitly.
3. Use `env` from `@/env/server` for secrets — never `process.env`.
4. For responses that should be cached, set `export const revalidate = <seconds>`
   or use `NextResponse` cache headers. Set `"Cache-Control": "no-store"` for
   near-live data (see `api/fastswap-miles/by-address/route.ts`).
5. For streaming or non-JSON responses, use `Response` / `ReadableStream`.
6. Long-running work → background queue, not an API route. Vercel has timeout limits.

## Cron / scheduled routes

`src/app/api/cron/` exists for Vercel Cron. Protect with a bearer token from
env — never leave cron endpoints unauthenticated.

## Error logging

Use the project analytics helpers in `src/lib/analytics-server.ts` for
server-side events. Don't `console.error` secrets into production logs.

## Verification

- `npm run build` catches type errors across the server boundary.
- The `post-edit-build.sh` hook runs build automatically when you edit
  `src/app/api/**`, `src/middleware.ts`, `next.config.mjs`, `src/env/**`,
  or `src/actions/**`.
- Test the endpoint with `curl` before claiming complete:
  `curl -X POST http://localhost:3000/api/<name> -H 'Content-Type: application/json' -d '{...}'`.
- If the route has a colocated test under `tests/api/<name>.test.ts`,
  the `post-edit-test.sh` hook runs it automatically on save.
