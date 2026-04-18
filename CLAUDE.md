# CLAUDE.md

Claude Code-specific guidance. Portable spec lives in [`AGENTS.md`](./AGENTS.md); read it too.

@AGENTS.md

## How this repo is instrumented for you

Three primitives bridge your context window and this codebase:

- **`agent_docs/`** — reference layer, open on demand (progressive disclosure)
- **`.claude/skills/`** — domain knowledge + workflows you load when relevant
- **`.claude/agents/`** — subagents that run in their own context (firewalls)
- **`.claude/commands/`** — user-invocable slash commands for deterministic actions

Full map: [`.claude/README.md`](./.claude/README.md).

## Skills (load when task matches)

| Skill | Use when |
|---|---|
| `next-app-router` | Editing `src/app/`, routing, server actions, middleware, env vars |
| `defi-swap` | Swap flow, slippage, permit2, WETH wrap/unwrap, quote polling |
| `web3-wallet` | wagmi/viem/RainbowKit — connect, sign, send, balance reads |
| `dashboard-data` | Hooks under `src/hooks/`, tanstack-query patterns |
| `leaderboard-miles` | Leaderboard, miles, `show_miles_estimate` flag, referral tiers |
| `contract-abis` | Using `contracts-abi/` types; on-chain method calls |
| `ui-shadcn` | Components under `src/components/` — Radix/shadcn conventions |
| `testing-vitest` | Writing or running vitest tests |
| `skill-creator` | Authoring a new skill in this repo |

You decide when a skill is relevant based on its `description` frontmatter. Don't preload.

## Subagents (delegate research, not implementation)

- `explore-web3` — trace wagmi/viem/contract usage, return `file:line` citations
- `security-reviewer` — web3-focused review (reentrancy, permit2, secrets, SSR leaks)
- `ui-verifier` — boot dev server, verify routes / screenshots
- `abi-tracer` — map a contract/ABI to its call sites

Spawn a subagent whenever the task would otherwise read 10+ files in main context.

## Slash commands

`/prime` · `/typecheck` · `/lint` · `/test` · `/verify` · `/new-skill` · `/review-diff`

Definitions in [`.claude/commands/`](./.claude/commands/).

## Context hygiene

- Use `/clear` between unrelated tasks. Long sessions with drift produce worse code than short ones with better prompts.
- Prefer **subagents** for codebase investigation — the parent context stays clean.
- When compacting, preserve: current task, list of modified files, any contract addresses or tx hashes in play, and verification status.
- If you catch yourself reading the same file twice, note it — consider a skill or `agent_docs/` entry.

## Hooks (active — expect surprise feedback)

- **PostToolUse (Edit|Write|MultiEdit)** runs three hooks in sequence, each
  silent on success:
  - `post-edit-typecheck.sh` — `npx tsc --noEmit` on any `.ts`/`.tsx` edit.
  - `post-edit-test.sh` — runs `tests/<mirror>.test.*` if one exists for the
    edited file (or the edited file is itself a test).
  - `post-edit-build.sh` — runs `next build` only when the edit touches
    `src/app/api/**`, `src/middleware.ts`, `next.config.mjs`, `src/env/**`,
    or `src/actions/**`. Degrades to a notice if `.env.local` isn't populated.
- **Stop** runs `npm run format:check`. Prints non-conforming files if any.

If a hook complains, fix it before declaring the task complete.

## Verification > plausibility

The plan file states it plainly: **give Claude a way to verify its work**. Before reporting "done," run `/verify`. Don't trust types you didn't compile, tests you didn't run, or UI you didn't load.

## What NOT to do

- Do not add code style rules here — ESLint and Prettier own style. If a rule is worth enforcing, add an ESLint rule, not a CLAUDE.md line.
- Do not inline code snippets of files in this repo — they rot. Cite by path.
- Do not expand this file. If the new content is conditional on task type, it belongs in a skill. If it's a deterministic action, it belongs in a command or hook.
