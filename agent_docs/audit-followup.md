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

### ~~Further strictness flips~~ — ✅

`strict: true` is on. The remaining flags (`strictFunctionTypes`,
`strictBindCallApply`, `alwaysStrict`, `noImplicitThis`,
`strictPropertyInitialization`) produced zero new errors — the
strictNullChecks flip had already caught the hard cases.

### God files — pending splits

Documented under "Pending splits" in
[`agent_docs/architecture.md`](./architecture.md). Split AFTER seeding
component tests so regressions have an oracle.

- ~~`src/components/dashboard/LeaderboardTable.tsx` (~2700 LoC)~~ — ✅
  fully split across two phases. Parent is now **447 LoC (−84%)** and
  pure orchestration. Extracted 11 files under
  `src/components/dashboard/leaderboard/`:
  - Phase 1 (leaves): `LeaderboardRow`, `PaginatedLeaderboardModal`,
    `VolumeLeadersCard`, `EfficiencyLeadersCard`, `ReferralLeadersCard`,
    `RisingStarsCard`, `types.ts`.
  - Phase 2 (sections): `LeaderboardHeader`, `VolumeProgressAnalysis`,
    `MilesProgressAnalysis`, `VolumeModeTable`, `MilesModeTable`.
- ~~`src/components/modals/SwapConfirmationModal.tsx` (~1160 LoC)~~ — ✅
  split into `src/components/modals/swap-confirmation/*` (parent now
  623 LoC; seven presentational leaves + useSnapshotOnOpen hook).
- `src/hooks/use-swap-form.ts` (~620 LoC) — still pending.
- `PaginatedLeaderboardModal` — `renderStat` / `renderSubtext` callbacks
  cast their entry to `any` at every call site (see `LeaderboardTable.tsx`
  and the Volume/Efficiency/Referral/RisingStars cards). The right fix
  is to make the modal generic over `T extends PaginatedModalEntry`.
  Pre-existing from main's `e57a5f8`; worth cleaning when the modal is
  next touched.

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

### ~~Dev-server verification (`/verify-ui`)~~ — ✅

Slash command at `.claude/commands/verify-ui.md` delegates to the
`ui-verifier` subagent: boots `npm run dev`, curls `/`, `/dashboard`,
`/claim`, checks HTTP 200 + content markers, cleans up the server.
Not a visual-regression tool — catches provider crashes, missing env
vars, blank-page hydration; pixel drift still needs a human.

### Error taxonomy document

Map every upstream error string in `.external/mev-commit/tools/preconf-rpc/`
→ our normalized error class in `src/lib/settlement/transaction-errors.ts`
→ the UI message shown to the user. Saves agents a 3-file trace on
every error-handling bug.

### PR review automation

`security-reviewer` subagent on every PR via a GitHub Action that
posts a review comment. Nightly rather than per-PR to control cost.

### ~~Dependabot~~ — ✅

Configured in `.github/dependabot.yml`. Weekly npm bumps with grouping
(web3, react-ecosystem, testing, next, radix) so related libraries move
as one PR. Monthly GitHub Actions bumps. Majors are excluded — we open
those by hand after reading the migration guide.

### Performance budget

No bundle-size monitoring, no TTFB target. Agents can silently
regress perf with no feedback. `next build --profile` + a size-limit
diff on PRs would help.

### ~~Accessibility baseline~~ — ✅ seeded

Wired `axe-core` + `vitest-axe` into `tests/a11y/` as its own test tier.
First canary: `SwapToast.a11y.test.tsx` covers pending, confirmed, and
barter-slippage-failed states — zero WCAG 2.1 AA violations. Shared
`tests/utils/axe.ts` helper formats failures with rule id + help URL.
Expand coverage by copying the template as new critical components
split out (SwapConfirmationModal, LeaderboardHeader, AppHeader).

### Recent-incidents ledger

"Here are the 3 bugs shipped last quarter and what caused them."
Powerful as a negative-example signal for agents. Requires discipline
to maintain.

### Widen Stryker scope — 🟡 partial

Now mutates `slippage.ts`, `min-amount-out.ts`, `api/schemas.ts`, and
`token-resolver.ts` — the four pure modules with fast-check property
coverage. Still open: `leaderboard/paginate.ts` (has example tests but
no property coverage yet) and any new module that earns a property
suite (eth-path-tx, quote-guard, tokens/weth-utils).

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
1. **`use-swap-form.ts` decomposition** (last god-file, 620 LoC). Unlike
   the component splits, this one is risky without an oracle — the
   hook's pieces share state and effect ordering. Safer plan: extract
   clearly-pure sub-hooks (`useDebouncedValidating`, `useRefreshTimer`)
   with tests, rather than a wholesale rewrite.
2. **Full `strict: true`** — four remaining flags after
   strictNullChecks (strictFunctionTypes, strictBindCallApply,
   alwaysStrict, noImplicitThis). Should be cheap follow-ups.
3. **Performance budget + a11y baseline** — bundle-size monitoring and
   `axe-core` in happy-dom. Neither is urgent but both are cheap to
   wire once.

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
- Two god-files fully split: **SwapConfirmationModal** (1158→623 LoC,
  7 leaves + useSnapshotOnOpen) and **LeaderboardTable** (2711→447 LoC,
  11 leaves + types.ts under `src/components/dashboard/leaderboard/`).
- Dependabot landed + Stryker widened to four pure modules.
- Seeded the component-test pattern (`SwapToast`) with real-wagmi-hook
  mocking and a real Zustand store. Vitest now uses the automatic JSX
  transform (`esbuild: { jsx: "automatic" }`) so tests don't need an
  explicit `import React`. Total suite: 286 passing tests.
- **Merge-with-main alignment flow** landed: `.claude/skills/merging-main/`
  skill + `/realign` slash command. Playbook covers stale `src/lib/*`
  imports (folderization drift), ESLint-rule hits on new API routes,
  `any`/`@ts-ignore` additions, doc-index drift
  (`agent_docs/architecture.md`, `src/app/api/README.md`,
  `src/hooks/README.md`), test seeds, a11y sweeps. Ran it live against
  main's PR #109 merge — caught one broken `@/lib/site-config` import
  and two doc-tree entries, fixed in the same commit.
- Flipped `strictNullChecks: true` and rewrote `@/lib/api/parse` to the
  discriminated-union shape (`{ ok: true; data } | { ok: false; response }`).
  All 32 API route callers migrated to `if (!parsed.ok) return parsed.response`
  / `parsed.data.x`. Wallet-info + minting hooks now use `undefined` in
  place of `null` to align with React prop conventions; optional callbacks
  are `?.()` invoked. 40+ strict-null violations fixed across hooks,
  components, and settlement utilities.
