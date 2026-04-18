# Server actions

## Pattern

- Files live in `src/actions/`.
- Each file starts with `"use server"` as the first statement.
- Export typed async functions — they become callable from client components.

Existing example: `src/actions/capture-email.ts`.

## Rules

1. **Validate input with Zod** at the top of every action. Never trust client-supplied values.
2. **Return a typed result** — e.g., `{ ok: true } | { ok: false, error: string }`. Do not throw raw errors across the boundary; convert to serializable shapes.
3. **No secrets in return values.** If you caught an error that includes an API key or internal URL, strip it before returning.
4. **Use `env` from `@/env/server`.** Never `process.env`.
5. **Do not return non-serializable values** (Dates serialize; functions, Maps, Sets do not).

## Calling from a client component

```tsx
"use client"
import { captureEmail } from "@/actions/capture-email"
// call as a normal async function; Next handles the transport
```

## When NOT to use a server action

Use a Route Handler (`src/app/api/*/route.ts`) when:

- The endpoint is called by a non-browser client (cron, webhook, external service).
- You need full control over HTTP status codes and headers.
- The input is not JSON / form-data (e.g., binary upload).

## Verification

After editing a server action, run `npm run build` — actions have a server/client boundary that `tsc --noEmit` alone won't catch.
