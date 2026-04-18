---
name: dashboard-data
description: Use when adding or modifying hooks under src/hooks/, particularly dashboard/user-data hooks and anything using TanStack Query. Covers query-key conventions, prefetching (use-page-prefetch, use-prefetch-dashboard), and where to put shared helpers.
---

# Dashboard data (hooks & TanStack Query)

How this repo models server state. Follow existing patterns; do not introduce Redux / SWR / Jotai.

## When to use

- Adding or editing a hook in `src/hooks/`
- Introducing a new TanStack Query query or mutation
- Changing prefetching behavior on any route
- Debugging stale or flickering dashboard data

## Key files

- Barrel: `src/hooks/index.ts`
- Dashboard surface: `src/hooks/use-dashboard-data.ts`, `use-prefetch-dashboard.ts`, `use-dashboard-tasks.ts`
- User state: `src/hooks/use-user-points.ts`, `use-user-swaps.ts`
- Prefetch helper: `src/hooks/use-page-prefetch.ts`
- Query client: mounted in `src/components/providers.tsx`

## References

- Hook patterns: [`hook-patterns.md`](./hook-patterns.md)
- Query keys: [`query-keys.md`](./query-keys.md)

## Workflow

1. Check `src/hooks/index.ts` for an existing hook before creating a new one.
2. For a new query:
   - Name: `use-<noun>[-action]`. Filenames in kebab-case.
   - Query key: stable array, starts with the domain prefix (see `query-keys.md`).
   - `queryFn` is pure — no side effects, returns raw data.
   - `select` for derived state, not transforms that should happen in the component.
   - `staleTime` / `gcTime` chosen for the data's freshness requirements.
3. For server writes, use mutations with `onSuccess` invalidation of affected query keys.
4. If the hook reads wallet state, gate with `enabled: Boolean(address)`.
5. Add the export to `src/hooks/index.ts`.

## Guardrails

- Never fire a query in render without `enabled: ...` when it depends on wallet / auth state.
- Never share a query key between different data shapes — use distinct prefixes.
- Never put mutable refs in query keys — keys must serialize deterministically.
- Avoid `refetchInterval` unless the data is genuinely time-sensitive. Prefer event-driven invalidation.
- Do not add a new `QueryClient` — there's one, in `providers.tsx`.

## Verification

- `/verify`
- Inspect TanStack Query devtools (if enabled in dev) — look for unexpected retries, stale caches, duplicate keys.
