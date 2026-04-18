---
name: leaderboard-miles
description: Use when editing leaderboard UI, ranking logic, miles/rewards display, the Fuul integration, tier badges (Gold/Silver/Bronze), or the show_miles_estimate feature flag. Includes Referral Leaders tabs and the miles-gating rules from recent PRs.
---

# Leaderboard & miles

The reward-surface layer. Miles = points; tiers = ranking buckets.

## When to use

- Editing `src/hooks/use-leaderboard-data.ts`, `use-fuul-miles-leaderboard.ts`, `use-estimated-miles.ts`, `use-user-points.ts`, `use-surplus-rate.ts`
- Changing `src/lib/leaderboard-config.ts`, `src/lib/fuul.ts`, `src/lib/miles-events.ts`
- Touching the `show_miles_estimate` feature flag in `src/lib/feature-flags.ts`
- Editing leaderboard or miles components in `src/components/dashboard/` / `src/components/referral/`

## Key files

- Config: `src/lib/leaderboard-config.ts`, `src/lib/feature-flags.ts`
- Data: `src/hooks/use-leaderboard-data.ts`, `use-fuul-miles-leaderboard.ts`, `use-estimated-miles.ts`, `use-user-points.ts`, `use-surplus-rate.ts`
- SDK integration: `src/lib/fuul.ts`, `src/lib/miles-events.ts`
- API: `src/app/api/fastswap-miles/`, `src/app/api/fuul/`
- Human docs: `docs/leaderboard-queries.md`, `docs/miles-estimation.md`

## References

- Tier system: [`tiers.md`](./tiers.md)
- Feature flag behavior: [`feature-flag.md`](./feature-flag.md)

## Workflow

1. Determine whether the change is **data** (ranking rules, thresholds, query logic) or **display** (UI, labels, gating).
2. For data: consult `docs/leaderboard-queries.md` — the queries are non-trivial and have been tuned.
3. For miles display: ALL miles UI must respect `show_miles_estimate` — check the flag, gate the render.
4. For tier thresholds: edit `src/lib/leaderboard-config.ts`; do not hardcode tiers in components.
5. For Fuul SDK changes: wrap in `src/lib/fuul.ts`; do not import `@fuul/sdk` in components.

## Guardrails

- **`show_miles_estimate` is load-bearing.** Recent PRs (see git log) gated `UserSwapsTable`, the miles toggle, and the Referral Leaders Miles tab behind this flag. When adding miles UI, gate it too.
- **Do not display miles as a currency.** Copy says "miles" or "estimated miles" — never "$".
- **Leaderboard queries are expensive.** Reuse the existing query where possible; do not add per-user N+1 patterns.
- **Fuul SDK keys stay server-side.** Never instantiate Fuul with a key from a client component.

## Verification

- `/verify`
- Toggle the `show_miles_estimate` flag and confirm the gated UI disappears.
- Inspect leaderboard loading in TanStack Query devtools — one query per visible tier, not per row.
