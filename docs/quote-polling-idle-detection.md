# Quote polling & idle detection

> **Audience: humans.** Agent-facing guidance is in
> [`.claude/skills/defi-swap/quote-polling.md`](../.claude/skills/defi-swap/quote-polling.md).
> This file explains the user-observable behavior; the skill explains how to
> modify it.

The swap UI polls for fresh quotes every 15 seconds (Uniswap V3 Quoter + Barter validation). To avoid wasting RPC and Barter API calls when the user isn't actively using the page, polling pauses automatically and resumes with a fresh quote when the user returns.

## Detection methods

Two independent signals are combined via `usePageActive()`. The page is considered **active** only when both conditions are true:

| Signal | API | Inactive trigger | Resume trigger |
|---|---|---|---|
| **Tab visibility** | `document.visibilitychange` | Tab hidden / minimized / switched away | Tab becomes visible |
| **User idle** | DOM activity listeners | No `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, or `pointerdown` for 2 minutes | Any of those events fires |

## Behavior

| State | Quote timer | Barter validation |
|---|---|---|
| **Active** | Counts down from 15s, refetches at 0 | Fires on each new Uniswap quote (1.5s debounce) |
| **Inactive** (tab hidden OR idle) | Paused — countdown freezes | Paused — no new Uniswap quotes means no Barter calls |
| **Returning** to active | Immediate refetch, timer resets to 15s | Fires after the refetch produces a new quote |
| **Insufficient balance** | Runs normally (Uniswap quotes still shown) | Skipped — no Barter API call made |

When the user returns, the quote is always fresh — no stale prices shown.

## Insufficient balance guard

Barter validation is disabled when the user's `fromToken` balance is less than the entered sell amount. There is no point quoting a swap the user cannot execute. The Uniswap quote still displays so the user can see pricing, but the Barter `/route` call is suppressed until the balance is sufficient. This is enforced via the `enabled` flag passed to `useBarterValidation` in `use-swap-form.ts`.

## Barter re-validation on requote

Barter re-validates on every 15-second Uniswap requote cycle, even when `amountOut` is unchanged. A monotonic `quoteGeneration` counter in `use-swap-form.ts` increments each time a fresh quote lands and is included in Barter's input key, guaranteeing a new API call per cycle.

## Minimum "Calculating..." display time

The swap button's "Calculating..." state (`isBarterValidating`) is held for at least 1.5 seconds (`MIN_VALIDATING_DISPLAY_MS` in `use-barter-validation.ts`). If the Barter API responds faster than that, the settled state is delayed so the spinner doesn't flash. This prevents the button text from flickering between states on fast responses.

## Implementation

- **Hook:** `src/hooks/use-page-active.ts` — returns `boolean`, combines visibility + idle
- **Integration:** `src/hooks/use-swap-form.ts` — the 15-second refresh timer checks `isPageActive` before ticking, triggers an immediate refetch on reactivation, and tracks `quoteGeneration`
- **Barter:** `src/hooks/use-barter-validation.ts` — re-validates per `quoteGeneration`, enforces minimum validating display time, skipped when balance is insufficient

## Tuning

- **Idle timeout:** `IDLE_TIMEOUT_MS` in `use-page-active.ts` (default: 2 minutes). Shorter values save more calls but risk pausing on slow readers.
- **Activity events:** Listed in `ACTIVITY_EVENTS` in `use-page-active.ts`. All listeners use `{ passive: true }` to avoid scroll jank.
- **Min calculating display:** `MIN_VALIDATING_DISPLAY_MS` in `use-barter-validation.ts` (default: 1.5 seconds).
