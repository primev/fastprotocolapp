# Quote polling & idle detection

Quotes are perishable. Poll, but gate polling on user presence and stale detection.

## Source docs

`docs/quote-polling-idle-detection.md` is the human-facing deep-dive — read it first for rationale.

## Files

- `src/hooks/use-swap-quote.ts` — the polling hook
- `src/hooks/use-quote-guard-config.ts` — runtime polling config
- `src/hooks/use-page-active.ts` — page-visibility / idle detection
- `src/lib/quote-guard.ts` — staleness evaluation

## Design

1. Poll interval is adaptive. When the page is hidden or the user is idle, the interval backs off.
2. Every quote carries a timestamp and expected validity window.
3. Before showing a quote or enabling the action button, `quote-guard.ts` checks:
   - Is the quote fresher than the max-age?
   - Has the input/output amount deviated beyond the configured threshold since the quote was issued?
   - Are slippage bounds still satisfied?
4. Stale → quote is discarded, action button disabled, UI re-fetches.

## Touching the polling interval

Be cautious. Too fast = RPC load + rate limits. Too slow = stale quotes, user friction.

- Prefer tuning thresholds in `use-quote-guard-config.ts` (runtime-configurable) over hardcoded intervals.
- Changes here affect real user cost — test with a throttled network and an idle tab.

## Anti-patterns

- Don't disable the guard "to get a test to pass" — rewrite the test.
- Don't poll when the tab is hidden at the same rate as when visible.
- Don't silently refresh the quote mid-sign — the user is looking at a specific number; jumping it is worse than failing the swap.
