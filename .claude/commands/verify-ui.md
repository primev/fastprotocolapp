---
description: Boot the dev server and smoke-load the critical routes via the ui-verifier subagent.
---

Delegate to the `ui-verifier` subagent to boot the Next dev server, curl
the three load-bearing routes, and report any non-200 status or visible
content regression.

The subagent contract is in `.claude/agents/ui-verifier.md` — it starts
`npm run dev`, waits for port 3000 to return 200, then inspects each
target route. It must clean up the server before returning.

## Target routes

```
/             — landing / gate (AnimatedBackground + Swap heading)
/dashboard    — personal miles page (tabs: My Miles, etc.)
/leaderboard  — the LeaderboardTable route (Miles / Volume / Stats)
/claim        — Genesis SBT claim flow (SSR must 200 even without wallet)
```

Note: `/leaderboard` is the heavy refactor target (2711 → 447 LoC parent),
not `/dashboard`. Both are worth smoking because the header + providers
load on every authenticated route.

For each route, the subagent should verify:
- HTTP 200
- No console errors in the SSR response that would indicate a crashed
  provider (look for "Cannot read", "TypeError", stack traces in HTML).
  Note: Node Streams polyfill source bundled into pages includes the
  string "TypeError" in static error-class definitions — distinguish
  from real "Application error" markers.
- A content marker proving the right template rendered
  ("LEADERBOARD" on /leaderboard, "Genesis" on /claim, Swap heading on /).

## Known operational gotchas

- A stale `.next/` directory from a prior branch can 500 every route on
  boot with "Cannot find module './NNNN.js'" — the dev server builds
  per-branch. If this happens, `rm -rf .next` and restart.
- Without `ANALYTICS_DB_AUTH_TOKEN` set, analytics SSR fetches return
  401; pages are expected to render skeleton/empty states (not crash).

## What this command is NOT

This isn't a visual-regression tool. It catches provider crashes,
missing env vars, and blank-page hydration failures — not pixel-level
drift. For visual parity after a refactor, the human has to load the
route in a browser.

## Usage

```
/verify-ui
```

The subagent returns a structured summary; forward it verbatim to the
user and wait for instruction before making code changes.
