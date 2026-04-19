# Fast Protocol App

The official web application for [Fast Protocol](https://fastprotocol.io) — a coordinated rewards layer providing lightning-fast transactions on Ethereum L1 with tokenized MEV rewards.

> This README serves **two audiences**: humans exploring the project (what it is, how to run it, how it's tested) and AI agents about to edit it (how to orient, where docs live, what hooks fire). Skim top-to-bottom for the former; jump to [Working with AI agents](#working-with-ai-agents) for the latter.

---

## What it is

Fast Protocol App is the primary interface for users to interact with Fast Protocol. Users can claim their Genesis SBT (Soul Bound Token) badges, track their rewards and activity, participate in quests, and climb the leaderboard.

### Key features

- **Genesis SBT minting** — claim non-transferable Soul Bound Token badges that represent your participation in the Fast Protocol ecosystem
- **Dashboard** — track your swap volume, points, and rewards in real-time
- **Leaderboard** — compete with other users across Gold, Silver, and Bronze tiers based on trading volume
- **Referral system** — earn rewards by inviting others to join Fast Protocol
- **Partner quests** — complete tasks and quests from ecosystem partners
- **Fast RPC integration** — one-click setup to add Fast Protocol's RPC to MetaMask or Rabby wallet

### Tech stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router (React 18)
- **Language**: TypeScript (strict mode off — see `tsconfig.json`)
- **Styling**: Tailwind CSS
- **UI components**: shadcn/ui on Radix primitives
- **Web3**: wagmi 2, viem 2, RainbowKit, ethers 6
- **Data**: TanStack Query 5
- **Validation**: Zod + `@t3-oss/env-nextjs`
- **Testing**: Vitest 4 + fast-check + pg-mem + Stryker
- **Smart contracts**: Solidity with Foundry (protocol source of truth at [primev/mev-commit](https://github.com/primev/mev-commit))

---

## Getting started

```bash
npm install                # package-lock.json is authoritative — npm only
cp .env.example .env       # fill in the UUID placeholders where real values are needed
npm run dev                # dev server at http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build (needs a populated `.env`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Full suite, single pass (CI + agent-safe) |
| `npm run test:coverage` | v8 coverage report |
| `npm run test:fork` | Anvil fork tests (needs `FORK_RPC_URL`) |
| `npm run test:externals` | ABI drift diff vs upstream mev-commit (needs `/sync-externals` first) |
| `npm run test:mutation` | Stryker mutation testing |
| `npm run sync:externals` | Sync vendored external repos under `.external/` |
| `npm run format` / `format:check` | Prettier write / check |

## Project structure

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
contracts-abi/              Extracted ABI JSON (diffed vs upstream by the externals CI)
docs/                       Human-facing deep-dives (banner-gated)
agent_docs/                 Agent-facing reference/map layer
.claude/                    Skills, subagents, slash commands, hooks, externals manifest
.external/                  Vendored upstream repos (gitignored; rebuilt by /prime)
.github/workflows/          CI pipeline
```

---

## Testing

The suite covers ten layers, each catching a class of bug the others can't:

| Layer | Purpose | Runs via |
|---|---|---|
| Unit / example | Behavior at specific inputs | `npm run test:run` |
| Property (fast-check) | Rules across the whole input space | `npm run test:run` |
| Integration (pg-mem) | Real SQL execution for API routes | `npm run test:run` |
| Cross-module invariants | Rules spanning module boundaries | `npm run test:run` |
| ABI shape | JSON sanity + canonical signatures | `npm run test:run` |
| EIP-712 signing | Typed-data hash stability + Permit2 domain separator | `npm run test:run` |
| Upstream API contracts | Fuul/Barter response schemas + fixtures | `npm run test:run` |
| Hook (happy-dom) | React hooks via `renderHook` | `npm run test:run` |
| Upstream ABI drift | Our ABIs vs vendored mev-commit copies | `npm run test:externals` (after `/sync-externals`) |
| Fork (anvil) | On-chain `DOMAIN_SEPARATOR()` vs off-chain snapshot | `npm run test:fork` |
| Mutation (Stryker) | Tests of the tests — catches quality drift | `npm run test:mutation` |

**232 tests in the default run; suite completes in under a second.** Fork, externals-drift, and mutation are opt-in because they need network / extra time.

## CI pipeline

Six GitHub Actions workflows under `.github/workflows/`:

| Workflow | Trigger | Gates PR? |
|---|---|---|
| `format.yml` | PR + push to main | ✅ |
| `verify.yml` | PR + push to main | ✅ (typecheck + 232 tests) |
| `build.yml` | PR + push, path-filtered | ✅ (when API / middleware / env / server-actions / next.config touched) |
| `fork.yml` | nightly + manual | ❌ (scheduled canary; needs `FORK_RPC_URL` secret) |
| `externals.yml` | weekly + manual | ❌ (syncs mev-commit, runs ABI drift test) |
| `mutation.yml` | weekly + manual | ❌ (quality signal; uploads HTML artifact) |

---

## Working with AI agents

This repo is instrumented for agentic development. If you're an AI agent starting a session, run **`/prime`** first — it's the single command that loads the project mental model.

### What `/prime` does

1. Syncs every external workspace declared in `.claude/externals.json`
   (fast-forward clone or refresh; prints current SHA + age).
2. Reads the five orientation files in order:
   `CLAUDE.md` → `AGENTS.md` → `agent_docs/stack.md` → `agent_docs/architecture.md` → `agent_docs/verification.md`.
3. Summarizes the project in 5 bullets.
4. Lists available slash commands, skills, and external workspaces.

### Primitives

| Thing | Where |
|---|---|
| **Portable spec** | [`AGENTS.md`](./AGENTS.md) — works across Claude Code, Codex, Cursor, Amp, Jules |
| **Claude Code specifics** | [`CLAUDE.md`](./CLAUDE.md) — hooks, subagents, and harness details |
| **Reference / map layer** | [`agent_docs/`](./agent_docs) — architecture, stack, web3, testing, verification, glossary, external workspaces |
| **Skills (how-to)** | [`.claude/skills/`](./.claude/skills) — load on relevance (defi-swap, web3-wallet, testing-vitest, external-mev-commit, etc.) |
| **Subagents (firewalls)** | [`.claude/agents/`](./.claude/agents) — explore-web3, security-reviewer, ui-verifier, abi-tracer |
| **Slash commands** | [`.claude/commands/`](./.claude/commands) — `/prime`, `/verify`, `/test`, `/sync-externals`, `/review-diff`, etc. |
| **Followups / state** | [`agent_docs/audit-followup.md`](./agent_docs/audit-followup.md) — outstanding work, testing-layer status, open gaps |

### Documentation layers

Three surfaces with non-overlapping roles. When in doubt, this is the precedence:

| Layer | Audience | Role |
|---|---|---|
| `.claude/skills/` | agents | HOW-TO — patterns, do/don't, code snippets |
| `agent_docs/` | agents | MAP — pointers to code + cross-links |
| `docs/` | humans | NARRATIVE — UX behavior, SQL reference, product flow (banner-gated) |

Each `docs/*.md` carries an "Audience: humans" banner pointing to the authoritative skill so agents don't accidentally treat it as load-bearing.

### PostToolUse hooks (silent on success, loud on failure)

| Hook | When it fires | What it does |
|---|---|---|
| `post-edit-typecheck.sh` | After any `.ts`/`.tsx` edit | `tsc --noEmit` |
| `post-edit-test.sh` | After any source edit | Runs the mirror test in `tests/<mirror>.test.*` if one exists |
| `post-edit-build.sh` | When API / middleware / env / server-actions / next.config changes | `next build` |
| `stop-format-check.sh` | At session end | `prettier --check` |
| `externals-sync.sh` | From `/prime` and `/sync-externals` | Clones / fetches / fast-forwards vendored external repos |
| `pre-commit-external-guard.sh` | Optional git pre-commit | Refuses commits with staged changes under `.external/` |

The pre-commit guard is shipped as a script — install once per clone:

```bash
ln -sf ../../.claude/hooks/pre-commit-external-guard.sh .git/hooks/pre-commit
```

### External workspaces — reading upstream repos as local context

Some cross-repo context (protocol types, canonical ABIs, upstream handler shapes) is better as vendored read-only files than as MCP round-trips. The pattern:

- `.claude/externals.json` declares external repos with `name`, `origin`, `ref`, sparse paths, and freshness thresholds.
- `/prime` and `/sync-externals` materialize them under `.external/<name>/` — gitignored, rebuilt on demand.
- Each external gets a skill (`.claude/skills/external-<name>/`) that tells agents WHEN to load it and a scope map (`agent_docs/external-<name>.md`) that shows WHERE inside the external to look.

Current externals:

| Name | Upstream | Scope map |
|---|---|---|
| `mev-commit` | [primev/mev-commit](https://github.com/primev/mev-commit) | [`agent_docs/external-mev-commit.md`](./agent_docs/external-mev-commit.md) |

Design rationale and the full add-a-new-external recipe: [`agent_docs/external-workspaces-plan.md`](./agent_docs/external-workspaces-plan.md).

### The one-sentence workflow

**Edit → PostToolUse hooks fire → `/verify` before handoff → push → CI re-runs verify + build + format on every PR.**

Fork, externals, and mutation tests run on schedule (or manual dispatch) and don't gate PRs.

---

## Links

- **Website**: [fastprotocol.io](https://fastprotocol.io)
- **OpenSea**: [Fast Protocol Genesis SBT](https://opensea.io/collection/fast-protocol-genesis-sbt)
- **Discord**: [discord.com/invite/fastprotocol](https://discord.com/invite/fastprotocol)
- **Telegram**: [t.me/Fast_Protocol](https://t.me/Fast_Protocol)
- **X (Twitter)**: [@Fast_Protocol](https://x.com/Fast_Protocol)
- **Protocol repo**: [primev/mev-commit](https://github.com/primev/mev-commit) (vendored under `.external/` for agent context)

## License

This project is licensed under the Business Source License 1.1. See [LICENSE](LICENSE) for details.

---

Built by [Primev](https://primev.xyz)
