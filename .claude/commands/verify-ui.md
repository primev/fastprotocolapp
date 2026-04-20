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
/           — landing / gate (AnimatedBackground + landing copy)
/dashboard  — leaderboard + user performance cards
/claim      — Genesis SBT claim flow (needs wallet, but SSR must 200)
```

For each route, the subagent should verify:
- HTTP 200
- No console errors in the SSR response that would indicate a crashed
  provider (look for "Cannot read", "TypeError", stack traces in HTML)
- A content marker proving the right template rendered
  ("LEADERBOARD", "Genesis", the gate's "Swap" heading)

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
