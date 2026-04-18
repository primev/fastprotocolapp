# Tiers

Gold / Silver / Bronze — volume-based buckets.

## Source of truth

`src/lib/leaderboard-config.ts` defines tier thresholds and display metadata. Never hardcode a threshold in a component.

## How rank is computed

See `docs/leaderboard-queries.md` for the authoritative query. Summary:

- Aggregate user swap volume over the configured window.
- Bucket by tier threshold.
- Rank within tier by volume (descending).

## Display rules

- Show tier badge via the tier component in `src/components/dashboard/` (existing patterns — reuse, don't recreate).
- Gold > Silver > Bronze visual hierarchy.
- User's own rank is highlighted; everyone else is neutral.

## Edge cases

- New user (no volume) — does not appear on leaderboard; show a "join" CTA if relevant.
- User at tier boundary — ties broken by earliest-to-reach-threshold (check query spec).
- Tier threshold changes — config-driven; do not retroactively rewrite user badges client-side. Server data drives.

## Don't

- Don't add a "Platinum" / "Diamond" tier without a config change + UI additions. The three-tier system is a product decision.
- Don't surface raw volume numbers in a context where a tier label is more meaningful.
