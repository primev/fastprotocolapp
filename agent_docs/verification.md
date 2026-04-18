# Verification

> The single highest-leverage thing you can do is give yourself a way to verify your work.
> — adapted from Anthropic's Claude Code best practices.

Before reporting any change as complete, run `/verify`. If you can't run `/verify`, say so explicitly — do not claim success.

## The verification stack

| Step | Command | What it proves |
|---|---|---|
| 1 | `npm run typecheck` (`tsc --noEmit`) | Types compose; no `any`-induced regressions Claude can see |
| 2 | `npm run lint` (`next lint`) | No lint regressions |
| 3 | `npm run test:run` | Existing tests still pass; new tests pass |
| 4 | `npm run format:check` | Formatting intact (also enforced by the Stop hook) |
| 5 (UI) | `npm run dev` + manual / Chrome extension | Rendered output matches intent |
| 6 (build) | `npm run build` | Next build succeeds (catches server/client boundary bugs, env-var gaps) |

Steps 1–4 run from the `/verify` slash command. Step 5 is covered by the `ui-verifier` subagent when applicable. Step 6 is intentionally not automated — it's slow and usually only needed before a release.

## When to run build

Run `npm run build` when:

- Editing `next.config.mjs`
- Adding a new env var (so t3-oss catches it)
- Changing the server/client boundary (`"use client"` directives, server actions, middleware)
- Editing anything under `src/app/api/`

## UI verification

For UI changes, do not trust that the component "looks right" from reading the diff. Options, in descending order of preference:

1. Claude-in-Chrome extension (if installed) — has `ui-verifier` start the dev server and drive the UI.
2. Take a screenshot via Playwright/Puppeteer if the flow is scripted.
3. At minimum: `curl http://localhost:3000/<route>` and grep for expected markers.

If you skipped visual verification, say so in your handoff.

## Hooks that verify for you

- **PostToolUse (Edit|Write|MultiEdit)** — runs `tsc --noEmit` after TS edits. Silent on success.
- **Stop** — runs `format:check`. Silent on success.

Hooks catch regressions between checkpoints. They do **not** replace `/verify`; they complement it.

## Reporting

Tell the user which checks passed and which didn't. If something is unverifiable in the current environment (no browser, no DB, etc.), say so — don't bluff.
