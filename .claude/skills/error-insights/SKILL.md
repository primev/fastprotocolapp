---
name: error-insights
description: Use this skill when the user asks to analyze, investigate, summarize, or report on errors from Vercel/Groundcover. Triggers include phrases like "what's breaking," "error report," "daily error analysis," "why are we getting errors," "review production errors," or any request involving Groundcover MCP and the Vercel log drain. Produces a deduplicated daily report and maintains a persistent library so previously-analyzed errors are not re-analyzed.
---

# Error Insights

Analyze production errors that flow into Groundcover via the Vercel log
drain, cluster them by root cause, and produce a daily report. Maintain a
persistent library of past insights so errors seen before are counted but
not re-analyzed.

## Pipeline this skill targets

This repo emits errors to Groundcover through Vercel runtime logs:

1. **Client tx errors** → `src/lib/report-client-error.ts` filters
   user-rejections, dedupes, rate-limits 20/min/tab → POST
   `/api/client-error`.
2. **`/api/client-error`** (`src/app/api/client-error/route.ts`)
   zod-validates the payload, then emits one structured line:
   `console.error("[client-error] " + JSON.stringify({...}))`.
3. **Server-side errors** in any other route handler hit Vercel logs the
   same way via `console.error`.
4. **Vercel log drain** ships every runtime log line to Groundcover.

So Groundcover is the source of truth, and the high-signal lines start
with the `[client-error]` prefix and carry a stable JSON envelope.

## Envelope fields to fingerprint on

From the payload schema in `src/app/api/client-error/route.ts`:

- `name` — Error class (e.g. `TransactionExecutionError`)
- `viem.rootCauseName` / `viem.shortMessage` — viem-walked root cause
  (most stable fingerprint when present)
- `context.source` — emitting hook/component (e.g. `use-swap-confirmation`,
  `SwapToast`, `use-barter-validation`)
- `message` — fall back when viem fields are absent; strip volatile bits

**Exclude** from the fingerprint: `sessionId`, `url`, `userAgent`,
`timestamp`, `ip`, request IDs, tx hashes, addresses, exact line numbers,
specific token amounts.

## Library

Maintain `./error-insights/_library.json`:

```json
{
  "clusters": {
    "<cluster_id>": {
      "fingerprint": "<stable hash of normalized signature>",
      "title": "short human-readable title",
      "first_seen": "YYYY-MM-DD",
      "last_seen": "YYYY-MM-DD",
      "total_count": 0,
      "implicated_files": ["src/hooks/use-swap-confirmation.ts"],
      "context_sources": ["use-swap-confirmation", "SwapToast"],
      "hypothesis": "the analysis from the first time this was seen",
      "suggested_next_step": "one sentence",
      "status": "open",
      "streak_days": 0,
      "last_fix_attempt_sha": null,
      "daily_counts": { "YYYY-MM-DD": 0 }
    }
  }
}
```

If the file does not exist, create it with `{"clusters": {}}`.

## Each run

1. Pull the last 24 hours of logs from the Groundcover MCP. Filter to
   error-level lines and lines whose message starts with
   `[client-error]`. Drop warnings/info.

2. For `[client-error]` lines, parse the JSON tail. For other error lines
   (server route handlers, framework), normalize the message string by
   stripping timestamps, request IDs, user IDs, addresses, tx hashes,
   exact line numbers (keep file + function), and specific values.

3. Build a fingerprint per error:
   - Prefer `viem.rootCauseName + viem.shortMessage` when present.
   - Else `name + normalized(message) + context.source`.
   - Hash the result for `fingerprint`.

4. Group today's errors by fingerprint and count occurrences.

5. For each fingerprint group:
   - **Found in `_library.json`**: increment `total_count`, update
     `last_seen`, add to `daily_counts`. Do NOT re-read code. Do NOT
     re-analyze. Do NOT regenerate the hypothesis.
   - **New**: read implicated code (`context.source` → grep the hook /
     component file), check `git log --since="7 days ago"` on those
     files, form a hypothesis and one-line next step. Add a new entry
     with today as `first_seen`.

6. Update persistence signals on every cluster:
   - `streak_days` — consecutive days with ≥1 occurrence (reset to 0 on
     a zero-count day, increment otherwise).
   - `age_days` — `today - first_seen`.
   - `volume_tier` — `low` (<10/day), `medium` (10–100/day), `high`
     (>100/day) based on today's count.
   - `chronic` — `true` if daily count is within ±20% of the 7-day
     average for ≥5 of the last 7 days (persistent, not spiking).
   - `untouched` — `true` if no commit has touched any
     `implicated_files` since `first_seen` (i.e. no fix shipped).

7. Save the updated `_library.json`.

8. Write the daily report to `./error-insights/YYYY-MM-DD.md`:
   - Summary line — total errors, # unique clusters, # new, # recurring,
     # persistent.
   - **New today** — full analysis for new clusters only (title,
     fingerprint snippet, implicated files, recent commits on those
     files, hypothesis, suggested next step).
   - **Persistent** (place ABOVE Recurring) — clusters with
     `streak_days ≥ 3`. Sort by `streak_days × volume_tier_weight`
     desc. For each: title, streak, age, volume tier, `untouched` flag,
     today's count, 7-day total, cluster_id. At `streak_days ≥ 7` add
     a one-line nudge: `"Seen daily for Nd — consider opening a ticket"`.
     At `streak_days ≥ 14` AND `untouched: true`, escalate the nudge
     to bold/asterisked.
   - **Recurring** — compact table for non-persistent repeats: title,
     today's count, 7-day count, trend arrow, cluster_id. No re-analysis.
   - **Watch list** — clusters whose daily count grew >50% vs. 7-day
     average, or any new cluster with >100 occurrences on day one.

9. Read-only on the repo. Do not modify source code.

## Notes

- If the MCP returns no errors, append `0` to all open clusters'
  `daily_counts` for today and write a one-line report.
- If a cluster has zero occurrences for 14 consecutive days, mark
  `status: "resolved"` so it falls off the watch list.
- `report-client-error.ts` already filters `UserRejectedRequestError` and
  the `code === 4001` family — if any slip through (e.g. from server
  routes), filter them again here so wallet rejections never become a
  cluster.
- The reporter rate-limits to 20/min per tab. A real error storm caps at
  that ceiling per-session — if a cluster's count looks artificially flat
  near `20 * active_sessions`, note it in the report.
