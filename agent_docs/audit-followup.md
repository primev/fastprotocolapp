# Audit follow-up — remaining work

This file tracks what's **done** and what's **left** for the
agentic-repo-design effort. Update entries as they land; delete when
they're no longer applicable.

---

## ✅ Completed

### Structural cleanup
- Removed 570 LoC of dead `fast-settlement-v2-1.ts` / `v3-abi.ts` + the
  77-line dead `fetchQuote` in `src/hooks/use-swap-quote.ts`.
- Folderized `src/lib/` into `tokens/ · swap/ · settlement/ · config/ · api/`.
- Rebuilt `src/hooks/index.ts` as a full `export *` barrel (was 9/52).
- Moved tests to a clean top-level `tests/` mirroring `src/`.
- Created `src/lib/api/{parse,schemas,upstream}.ts` Zod helpers +
  upstream-response schemas; **24 of 52 API routes** on the new pattern.
- Three-tier documentation convention (skills = how-to, agent_docs = map,
  docs = human-facing banner-gated).

### Verification infrastructure
- PostToolUse hooks: typecheck, mirror-test-on-save, build-on-boundary-edit.
- Stop hook: format:check.
- Pre-commit guard rejecting staged changes under `.external/`.
- CI workflows: `format`, `verify`, `build` (path-gated), `fork` (nightly),
  `externals` (weekly), `mutation` (weekly).

### Testing layers — all 10 wired

| Layer | Status | Command |
|---|---|---|
| Unit / example | ✅ | `npm run test:run` |
| Property / fuzz (fast-check) | ✅ | `npm run test:run` |
| Integration (pg-mem real SQL) | ✅ (one route; others blocked by window-fn gap) | `npm run test:run` |
| Cross-module invariants | ✅ | `npm run test:run` |
| ABI shape + upstream drift | ✅ | `npm run test:run` + `npm run test:externals` |
| EIP-712 encoding + Permit2 DOMAIN_SEPARATOR | ✅ | `npm run test:run` |
| Upstream API contracts (+ runtime guards) | ✅ | `npm run test:run` |
| Hook tests (happy-dom + renderHook) | ✅ (4 files, 50 tests — slippage, quote-guard-config, balance-flash, page-active) | `npm run test:run` |
| Fork tests (anvil + mainnet) | ✅ | `FORK_RPC_URL=https://ethereum-rpc.publicnode.com npm run test:fork` |
| Mutation testing (Stryker) | ✅ (96.3% on slippage module) | `npm run test:mutation` |

### External workspaces pattern
- `.claude/externals.json` declarative manifest + sync hook.
- `/prime` and `/sync-externals` commands; `.external/` gitignored.
- First external wired: `mev-commit` (sparse-checkout of 10 paths, 9MB).
- Scope map in `agent_docs/external-mev-commit.md`.
- `external-mev-commit` skill for WHEN-to-load signaling.
- ABI drift test that diffs our local ABIs against the vendored upstream
  copies when present.

### Agent-velocity docs + API / strictness completion
- `src/app/api/README.md` — 52-route discovery index, grouped by domain.
  **Every route that takes user input is now Zod-validated through
  `@/lib/api/parse`.** ESLint rule reports zero violations.
- `src/hooks/README.md` — 50-hook index grouped by concern.
- `agent_docs/db-schema.md` — both app-owned Postgres tables documented,
  routes that touch each, test-fixture source-of-truth pointer.
- `INVARIANTS.md` at repo root — every load-bearing contract linked to
  the test that enforces it.
- ESLint rule warning on imperative validation in `src/app/api/**/route.ts`
  (auto-surfaces any regression).
- `tsconfig.json` now has `noImplicitAny: true`, **`noUnusedLocals: true`,
  `noUnusedParameters: true`**. Installed `@types/pg` and
  `eslint-plugin-unused-imports` along the way. 77 dead declarations
  purged in the strictness flip.

---

## 🟡 Outstanding — pick up from here

### Further strictness flips (incremental)
Each is a separate, reviewable PR so the blast radius stays small.

1. **Full `strict: true`** — strictNullChecks is now ON. The remaining
   flags (`strictFunctionTypes`, `strictBindCallApply`, `alwaysStrict`)
   should be cheap follow-ups now that the load-bearing null/undefined
   fixes have landed.

### God files — pending splits

Documented under "Pending splits" in
[`agent_docs/architecture.md`](./architecture.md). Split AFTER seeding
component tests so regressions have an oracle.

- ~~`src/components/dashboard/LeaderboardTable.tsx` (~2700 LoC)~~ — ✅
  phase 1: extracted the 6 self-contained leaves (LeaderboardRow,
  PaginatedLeaderboardModal, Volume/Efficiency/Referral/RisingStars
  cards) + a `leaderboard/types.ts` file. Parent is now 1176 LoC
  (−57%). Phase 2 (pending): split the parent's stats/progress/analysis
  sections out of the main render.
- ~~`src/components/modals/SwapConfirmationModal.tsx` (~1160 LoC)~~ — ✅
  split into `src/components/modals/swap-confirmation/*` (parent now
  623 LoC; seven presentational leaves + useSnapshotOnOpen hook).
- `src/hooks/use-swap-form.ts` (~620 LoC) — still pending

### Seed more hook tests

Pattern now proven across four hooks (slippage, quote-guard-config,
balance-flash, page-active — 50 tests total covering localStorage,
fetch + fallbacks, timer-driven flash, Page Visibility API, and idle
detection). Next-tier candidates when a god-file split needs coverage:
- `use-waitlist-position` — fetcher + cache interaction
- `use-swap-quote` — polling + cancellation
- `use-rpc-test` — network-check state machine

### Component testing pattern — ✅ seeded

Seeded with `tests/components/swap/SwapToast.test.tsx`: renders a real
wagmi-dependent component under happy-dom with the wagmi hook, the
tx-confirmation polling hook, and the Web Audio preconfirm sound all
`vi.mock`'d, while letting the Zustand store run real. Copy this file
as the template for future component tests.

The vitest config also gained `esbuild: { jsx: "automatic" }` so source
files don't need to add `import React` to be testable — the Next.js
transform is assumed in production and is now matched by the test
runner.

Natural next candidates when splitting god-files:
`AmountInput.tsx` (pure, no wagmi — straight render/interact test),
`TokenSelectorModal.tsx` (Zustand + search filter),
leaderboard table sub-components as they emerge from the split.

### pg-mem limitation: window functions

`pg-mem` does not support `OVER (PARTITION BY ... ORDER BY ...)`.
The `user-community-activity` routes all read via `ROW_NUMBER() OVER`
to pick the most-recent row per entity, so they can't be
integration-tested in-process without a route refactor.

Path forward: use `testcontainers` + a real Postgres container
(~3s container startup per file, supports the full SQL surface).
Worth adding when we have more routes on window functions.

Until then, the window-function routes are unit-tested via mocked
`pool.query` — less thorough but not worse than no coverage.

---

## 🟢 Lower priority / nice-to-have

### Dev-server verification (`/verify-ui`)

`ui-verifier` subagent exists but the end-to-end flow isn't
exercised. A one-shot slash command that boots dev, loads the three
critical routes (`/`, `/dashboard`, `/claim`), and screenshots them
would close the visual-regression gap without setting up Playwright CI.

### Error taxonomy document

Map every upstream error string in `.external/mev-commit/tools/preconf-rpc/`
→ our normalized error class in `src/lib/settlement/transaction-errors.ts`
→ the UI message shown to the user. Saves agents a 3-file trace on
every error-handling bug.

### PR review automation

`security-reviewer` subagent on every PR via a GitHub Action that
posts a review comment. Nightly rather than per-PR to control cost.

### Dependabot

No dependency-update automation today. wagmi / viem / zod updates
sneak up.

### Performance budget

No bundle-size monitoring, no TTFB target. Agents can silently
regress perf with no feedback. `next build --profile` + a size-limit
diff on PRs would help.

### Accessibility baseline

Zero a11y tests. `axe-core` in happy-dom is ~30 min to wire up.

### Recent-incidents ledger

"Here are the 3 bugs shipped last quarter and what caused them."
Powerful as a negative-example signal for agents. Requires discipline
to maintain.

### Widen Stryker scope

Currently mutates only `src/lib/swap/slippage.ts`. Add more modules
as they earn property-test coverage — natural next targets:
`src/lib/api/schemas.ts`, `src/lib/tokens/token-resolver.ts`,
`src/components/dashboard/leaderboard/paginate.ts`.

### Extend `externals.json` to more upstreams

Pattern is proven; adding a new external is a one-file manifest edit
+ skill + scope map. Candidates as they become relevant: `@fuul/sdk`
source, the Uniswap V3 quoter ABI repo, a shared design-system repo.

---

## How this file stays honest

When you finish one of the outstanding items, move it from the
"Outstanding" section to the "Completed" section with a one-line
summary. When a new gap surfaces, add it here with a clear ROI
justification — not every followup deserves to live on this list.

Priority order as of the last update:
1. **Full god-file splits** (LeaderboardTable, SwapConfirmationModal).
   Component test pattern is now proven (SwapToast) — new leaf
   components can copy the mock-and-render template.
2. **Dependabot** — cheap ongoing value; one-file PR.
3. **Widen Stryker scope** to schemas.ts, token-resolver.ts,
   leaderboard/paginate.ts, min-amount-out.ts once they earn more
   property tests.
4. **Full `strict: true`** — four remaining flags after
   strictNullChecks (strictFunctionTypes, strictBindCallApply,
   alwaysStrict, noImplicitThis). Should be cheap follow-ups.

Items done since the last revision of this priority list:
- Finished API Zod migration. All input-taking routes now go through
  `@/lib/api/parse`.
- Flipped `noUnusedLocals` + `noUnusedParameters`. 77 dead
  declarations purged.
- Extracted `use-swap-form` math helpers into
  `@/lib/swap/min-amount-out` with 14 property tests. Contract-safety
  invariants (floor ≤ amountOut end-to-end, never tightens user's
  tolerance, monotone in Barter shortfall) are now independently
  verifiable without React.
- Seeded three more hook tests (`use-quote-guard-config`,
  `use-balance-flash`, `use-page-active`). Hook suite is now 4 files /
  50 tests, locking Edge Config fallback defaults, the 2000ms balance
  flash window, and the 2-minute idle-timer contract.
- Seeded the component-test pattern (`SwapToast`) with real-wagmi-hook
  mocking and a real Zustand store. Vitest now uses the automatic JSX
  transform (`esbuild: { jsx: "automatic" }`) so tests don't need an
  explicit `import React`. Total suite: 286 passing tests.
- Flipped `strictNullChecks: true` and rewrote `@/lib/api/parse` to the
  discriminated-union shape (`{ ok: true; data } | { ok: false; response }`).
  All 32 API route callers migrated to `if (!parsed.ok) return parsed.response`
  / `parsed.data.x`. Wallet-info + minting hooks now use `undefined` in
  place of `null` to align with React prop conventions; optional callbacks
  are `?.()` invoked. 40+ strict-null violations fixed across hooks,
  components, and settlement utilities.
