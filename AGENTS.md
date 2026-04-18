# AGENTS.md

Portable agent spec for this repo. Works across Claude Code, Codex, Cursor, Amp, Jules. Claude-specific additions live in [`CLAUDE.md`](./CLAUDE.md).

## What this project is

The **Fast Protocol App** — the web UI for Fast Protocol, a coordinated rewards layer with sub-second swaps on Ethereum L1 and tokenized MEV rewards. Features: swap interface, Genesis SBT claim, dashboard, leaderboard (Gold/Silver/Bronze), referrals, miles, Fast RPC one-click install.

## Stack (authoritative values live in `package.json`)

- **Framework**: Next.js 15 App Router, React 18
- **Language**: TypeScript (strict mode **off** — do not assume strict types)
- **Web3**: wagmi 2, viem 2, ethers 6, RainbowKit
- **Data**: TanStack Query 5, Zustand (minimal use)
- **UI**: Tailwind 3, shadcn/ui on Radix primitives
- **Testing**: Vitest 4
- **Validation**: Zod, `@t3-oss/env-nextjs`
- **Contracts**: Solidity under `contracts/` (Foundry); extracted types in `contracts-abi/`

## Setup

```bash
npm install        # package-lock.json is authoritative — this project uses npm, not bun
npm run dev        # Next dev server
```

## Verification (run these before declaring any change done)

```bash
npm run typecheck  # tsc --noEmit — added as part of agentic setup
npm run lint       # next lint
npm run test:run   # vitest run (non-watch)
npm run format:check
```

The `/verify` slash command (Claude Code) runs the first three in sequence.

## Read these before editing

1. [`agent_docs/stack.md`](./agent_docs/stack.md) — versions, quirks
2. [`agent_docs/architecture.md`](./agent_docs/architecture.md) — directory map with file-level callouts
3. [`agent_docs/verification.md`](./agent_docs/verification.md) — how to prove a change is correct
4. [`agent_docs/glossary.md`](./agent_docs/glossary.md) — domain terms (miles, SBT, permit2, tiers)

The rest of `agent_docs/` is progressive disclosure — open only when relevant.

## Hard constraints

- **Never** write to `.env` or `.env*.local`. Update `.env.example` instead.
- **Never** commit secrets. Treat anything matching `*_API_KEY`, `*_TOKEN`, `*_SECRET` as forbidden in commits.
- **Never** edit files under `contracts/` without human review — Solidity changes require audit consideration.
- **Never** log, transmit, or persist private keys / seed phrases / signed payloads anywhere.
- Do not add dependencies without checking for an existing utility first (`src/lib/` has 50+ utilities).

## PR conventions

From recent git history: conventional-ish commits — `feat(scope): …`, `fix(scope): …`. Branch names use kebab-case topic prefixes (e.g., `hide-miles-leaderboard-stats`, `bug-hide-miles`, `remove-dashboard-banner`).

## Structure at a glance

```
src/app/         App Router routes + api/ (~20 endpoints)
src/components/  React components by domain (swap, dashboard, claim, etc.)
src/hooks/       Custom hooks (50+); see agent_docs/architecture.md
src/lib/         Utilities, wagmi config, swap logic, contract configs, ABIs
src/env/         t3-oss env validation (server.ts)
src/stores/      Zustand stores (currently just swapToastStore)
src/actions/     Server actions
src/test/        Vitest setup + utils
contracts/       Solidity (Foundry) — edit with care
contracts-abi/   Extracted ABI types used by the app
docs/            Human-facing deep-dives (leaderboard, miles, swap, tx, quote polling)
agent_docs/      Reference layer for agents (progressive disclosure)
.claude/         Claude Code skills, subagents, commands, hooks, settings
```

## Working style

- **Read before write.** Inspect the existing function/hook before introducing a new one.
- **Pointers over copies.** Cite `src/path/file.ts:42`; don't paste code.
- **Verify yourself.** Run `/verify` before handing a task back.
- **Use subagents for research.** Reading many files in the main context wastes budget.
- **Ask before destructive work.** Migrations, schema changes, dep bumps, force-push, and anything under `contracts/` need confirmation.
