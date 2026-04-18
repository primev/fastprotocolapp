---
name: next-app-router
description: Use when editing files under src/app/, adding or changing routes, API endpoints under src/app/api/, server actions, middleware (src/middleware.ts), env vars, or the root layout. Covers Next.js 15 App Router conventions including "use client" boundaries and server components.
---

# Next.js 15 App Router

This repo runs Next 15 with the App Router on React 18. Server Components are the default; `"use client"` must be explicit.

## When to use

- Adding or editing a route under `src/app/**`
- Adding or editing an API route under `src/app/api/**`
- Editing `src/middleware.ts` or `src/app/layout.tsx`
- Adding an env variable or touching `src/env/server.ts`
- Using or adding a server action under `src/actions/`

## Key files

- `src/app/layout.tsx` — root layout, mounts `Providers`
- `src/components/providers.tsx` — wagmi, RainbowKit, TanStack Query, theme
- `src/middleware.ts` — request middleware (auth/redirect logic)
- `src/env/server.ts` — env schema (t3-oss)
- `next.config.mjs` — image domains, env loader via `jiti`

## Workflow

1. Decide Server vs Client Component. Default is Server. Add `"use client"` **only** when you need: hooks, state, browser-only APIs, wagmi, event handlers.
2. For API routes: use Route Handlers in `src/app/api/<name>/route.ts` with named exports (`GET`, `POST`, …).
3. For server actions: add under `src/actions/`. Must start with `"use server"`. Validate input with Zod.
4. For env access: `import { env } from '@/env/server'`. Do **not** read `process.env` directly.
5. Run `npm run build` after changes to server boundaries or env — catches mistakes the dev server misses.

## References

- Server actions: [`server-actions.md`](./server-actions.md)
- Env validation: [`env-validation.md`](./env-validation.md)
- API routes: [`api-routes.md`](./api-routes.md)

## Guardrails

- Never import server-only modules (e.g., `pg`, `googleapis`, env server vars) from a `"use client"` file — build will fail at deploy time.
- Server actions must validate input with Zod **before** any side effect.
- Do not put secrets in `NEXT_PUBLIC_*` vars; those ship to the browser.
- When adding a route, check `src/middleware.ts` for matching patterns — your new route may be unexpectedly gated.
- Keep `layout.tsx` lean — it runs on every render of every child route.

## See also

- `agent_docs/architecture.md` (full directory map)
- `agent_docs/env-vars.md`
