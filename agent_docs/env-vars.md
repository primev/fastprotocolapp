# Environment variables

Authoritative list: `.env.example` + `src/env/server.ts` (t3-oss validation). Never write to `.env` or `.env*.local`; always update `.env.example` when adding a var.

## Variables (from `.env.example`)

| Variable | Scope | Purpose |
|---|---|---|
| `EMAILOCTOPUS_API_KEY` | server | Waitlist / newsletter API auth |
| `EMAILOCTOPUS_LIST_ID` | server | Target list for signups |
| `FAST_RPC_API_TOKEN` | server | Bearer token for FastRPC read-only DB |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | client + server | Primary RPC transport + `alchemy_getTokenBalances` for the token selector's "Your tokens" section. App falls back to public RPCs if unset, but the held-token discovery feature breaks. |

Additional runtime vars (not in `.env.example` but consumed at deploy): Vercel-provided URL/env vars, Vercel Blob and Edge Config tokens (auto-injected by Vercel).

## How validation works

- `src/env/server.ts` defines the schema with `@t3-oss/env-nextjs` + Zod.
- `next.config.mjs` uses `jiti` to load the env module at build time so missing vars fail the build loudly.
- Client-safe vars must be prefixed `NEXT_PUBLIC_`.

## Adding a new variable

1. Add to `.env.example` with a **stub** value and a one-line comment.
2. Add to `src/env/server.ts` schema.
3. Document in this file.
4. Reference via `import { env } from '@/env/server'` (do not read `process.env` directly).

## Secrets you must never commit

Anything matching: `*_API_KEY`, `*_SECRET`, `*_TOKEN`, `*_PRIVATE_KEY`, `MNEMONIC`, seed phrases, signed transaction payloads. If you see one in a diff, stop and flag it.
