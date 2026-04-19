# Fast Protocol App

The official web application for [Fast Protocol](https://fastprotocol.io) — a coordinated rewards layer providing lightning-fast transactions on Ethereum L1 with tokenized MEV rewards.

## Overview

Fast Protocol App is the primary interface for users to interact with Fast Protocol. Users can claim their Genesis SBT (Soul Bound Token) badges, track their rewards and activity, participate in quests, and climb the leaderboard.

### Key Features

- **Genesis SBT Minting** — claim non-transferable Soul Bound Token badges that represent your participation in the Fast Protocol ecosystem
- **Dashboard** — track your swap volume, points, and rewards in real-time
- **Leaderboard** — compete with other users across Gold, Silver, and Bronze tiers based on trading volume
- **Referral System** — earn rewards by inviting others to join Fast Protocol
- **Partner Quests** — complete tasks and quests from ecosystem partners
- **Fast RPC Integration** — one-click setup to add Fast Protocol's RPC to MetaMask or Rabby wallet

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router (React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Web3**: wagmi 2, viem 2, RainbowKit, ethers 6
- **Data**: TanStack Query 5
- **Validation**: Zod + `@t3-oss/env-nextjs`
- **Testing**: Vitest 4 + fast-check + pg-mem + Stryker
- **Smart Contracts**: Solidity with Foundry

## Getting Started

```bash
npm install
cp .env.example .env   # fill in values where needed
npm run dev            # http://localhost:3000
```

The package manager is **npm** — `package-lock.json` is authoritative. Do not regenerate with `bun` or `pnpm`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build (requires populated `.env`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Full suite, single pass (CI + agent-safe) |
| `npm run test:coverage` | v8 coverage report |
| `npm run test:fork` | Anvil fork tests (requires `FORK_RPC_URL`) |
| `npm run test:mutation` | Stryker mutation testing |
| `npm run format` / `format:check` | Prettier write / check |

## Project Structure

```
src/
├── app/                    Next.js App Router — routes + API + middleware
│   ├── (app)/              Main authenticated shell
│   └── api/                ~53 route handlers (Zod-validated at the boundary)
├── components/             React components by domain
│   ├── dashboard/          Dashboard + leaderboard
│   ├── swap/               Swap UI
│   ├── ui/                 shadcn primitives
│   └── onboarding/         Onboarding flow
├── hooks/                  50+ custom hooks; full barrel in index.ts
├── lib/                    Utilities, wagmi config, domain logic
│   ├── api/                Zod schemas + parseJson/parseSearchParams helpers
│   ├── tokens/             Token data, ERC-20 / WETH ABIs, resolver, stablecoins
│   ├── swap/               Swap engine — quote guard, permit2, slippage, barter
│   ├── settlement/         Fast RPC + tx layer (db, rpc-status, transaction-errors)
│   ├── config/             site, network, leaderboard, feature-flags, constants
│   └── analytics/          SQL services for the analytics dashboard
├── env/                    t3-oss env validation (server-side)
├── stores/                 Zustand stores (swapToastStore)
├── actions/                Server actions
└── types/                  Cross-cutting type definitions

tests/                      Mirrors src/; all tests live at top level
├── api/                    API route tests (incl. pg-mem integration)
├── components/             Component tests
├── fixtures/               Stored upstream-API response fixtures
├── fork/                   Anvil fork tests (gated on FORK_RPC_URL)
├── hooks/                  Hook tests (happy-dom)
├── invariants/             Cross-module invariants
├── lib/                    Unit + property tests for src/lib/**
└── utils/                  Shared test helpers (pg-mem, arbitraries, mocks)

contracts/                  Solidity (Foundry) — edit with care
contracts-abi/              Extracted ABI JSON consumed by src/lib/tokens/*-abi.ts
docs/                       Human-facing deep-dives (banner-gated)
agent_docs/                 Agent-facing reference/map layer
.claude/                    Skills, subagents, slash commands, hooks
.github/workflows/          CI pipeline
```

## Testing

The suite covers nine layers, each catching a class of bug the others can't:

| Layer | Purpose | Runs via |
|---|---|---|
| Unit / example | Behavior at specific inputs | `npm run test:run` |
| Property (fast-check) | Rules across the whole input space | `npm run test:run` |
| Integration (pg-mem) | Real SQL execution for API routes | `npm run test:run` |
| Cross-module invariants | Rules spanning module boundaries | `npm run test:run` |
| ABI drift | JSON + const-ABI sanity vs canonical interfaces | `npm run test:run` |
| EIP-712 signing | Typed-data hash stability + injectivity + Permit2 domain separator | `npm run test:run` |
| Upstream API contracts | Fuul/Barter response schemas + fixtures | `npm run test:run` |
| Hook (happy-dom) | React hooks via `renderHook` | `npm run test:run` |
| Fork (anvil) | On-chain `DOMAIN_SEPARATOR()` vs off-chain snapshot | `npm run test:fork` |
| Mutation (Stryker) | Tests of the tests — catches quality drift | `npm run test:mutation` |

**230 tests in the default run; suite completes in under a second.** Fork and mutation are opt-in because they need network / extra time.

## CI Pipeline

Five GitHub Actions workflows under `.github/workflows/`:

| Workflow | Trigger | Gates PR? |
|---|---|---|
| `format.yml` | PR + push to main | ✅ |
| `verify.yml` | PR + push to main | ✅ (typecheck + 230 tests) |
| `build.yml` | PR + push, path-filtered | ✅ (when API / middleware / env / server-actions / next.config touched) |
| `fork.yml` | nightly + manual | ❌ (scheduled canary; needs `FORK_RPC_URL` secret) |
| `mutation.yml` | weekly + manual | ❌ (quality signal; uploads HTML artifact) |

## Working with AI agents

This repo is instrumented for agentic development:

- [`AGENTS.md`](./AGENTS.md) — portable spec (Claude Code, Codex, Cursor, Amp, Jules)
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code-specific additions
- [`agent_docs/`](./agent_docs) — on-demand reference: `architecture.md`, `stack.md`, `web3-integration.md`, `testing.md`, `verification.md`, `glossary.md`, and `audit-followup.md` (outstanding work)
- [`.claude/`](./.claude) — skills (how-to), subagents (context firewalls), slash commands (`/prime`, `/verify`, `/test`, etc.), and PostToolUse hooks

**Hooks fire on every file edit** (silent on success, loud on failure):
- `tsc --noEmit` after any `.ts`/`.tsx` change
- Auto-run the mirror test in `tests/` if one exists
- `next build` when the edit touches the server/client boundary

In a fresh Claude Code session, run `/prime` to load the project mental model.

### Documentation layers

| Layer | Audience | Role |
|---|---|---|
| `.claude/skills/` | agents | HOW-TO — patterns, do/don't, code snippets |
| `agent_docs/` | agents | MAP — pointers to code + cross-links |
| `docs/` | humans | NARRATIVE — UX behavior, SQL reference, product flow |

Each `docs/*.md` carries an "Audience: humans" banner pointing to the authoritative skill so agents don't accidentally treat it as load-bearing.

## Links

- **Website**: [fastprotocol.io](https://fastprotocol.io)
- **OpenSea**: [Fast Protocol Genesis SBT](https://opensea.io/collection/fast-protocol-genesis-sbt)
- **Discord**: [discord.com/invite/fastprotocol](https://discord.com/invite/fastprotocol)
- **Telegram**: [t.me/Fast_Protocol](https://t.me/Fast_Protocol)
- **X (Twitter)**: [@Fast_Protocol](https://x.com/Fast_Protocol)

## License

This project is licensed under the Business Source License 1.1. See [LICENSE](LICENSE) for details.

---

Built by [Primev](https://primev.xyz)
