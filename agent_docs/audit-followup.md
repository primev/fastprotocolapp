# Audit follow-up — remaining work

Generated after the agentic-repo-design cleanup pass. This file lists items
that appeared during the follow-up audit but were deferred for scope reasons.
Delete or update entries as they land.

## Completed in the original pass

- Removed 570 LoC of dead `fast-settlement-v2-1.ts` / `v3-abi.ts` + the
  77-line dead `fetchQuote` in `src/hooks/use-swap-quote.ts`.
- Folderized `src/lib/` into `tokens/ · swap/ · settlement/ · config/`.
- Rebuilt `src/hooks/index.ts` as a full `export *` barrel (was 9/52).
- Built a clean top-level `tests/` directory mirroring `src/`. Moved the
  3 existing tests; added 6 new ones. Now 100 tests across 9 files.
- Created `src/lib/api/{parse,schemas}.ts` Zod validation helpers + tests.
  Migrated **24 of 53** API routes to the new pattern.
- Added two PostToolUse hooks (`post-edit-test.sh`, `post-edit-build.sh`).
- Consolidated doc layers: `skills/` owns how-to, `agent_docs/` owns map,
  `docs/` owns human-facing deep-dives (banner-gated).
- Updated `AGENTS.md`, `CLAUDE.md`, and every skill that pointed at the
  old flat `src/lib/` layout.

## Outstanding — pick up from here

### pg-mem limitation: window functions

`pg-mem` (the in-process Postgres we use for API-route integration tests)
does not support `OVER (PARTITION BY ... ORDER BY ...)` window functions
yet. The `user-community-activity` routes all read via `ROW_NUMBER() OVER`
to pick the most-recent row per entity, so they can't be integration-tested
in-process without a route refactor.

Path forward: use `testcontainers` + a real Postgres container. Slower
(~3s container startup per file) but supports the full SQL surface. Worth
adding when we have more routes on window functions.

Until then, the window-function routes are unit-tested via mocked
`pool.query` — less thorough but not worse than no coverage.



### API routes not yet on Zod (29 remaining)

Pattern: replace imperative `if (!x) return 400` with
`parseJson` / `parseSearchParams` / `parseParams` from `@/lib/api/parse`.

Most of these take an `address` query param and should use
`walletAddressSchema`. Routes that take pagination should use
`paginationSchema`. See
[`.claude/skills/next-app-router/api-routes.md`](../.claude/skills/next-app-router/api-routes.md)
for the full pattern.

User-input routes (higher priority):
- `src/app/api/waitlist/{count,list}/route.ts`
- `src/app/api/whitelist/{list,generate,check,convert-waitlist-to-whitelist,whitelist-swap-volume-holders}/route.ts`
- `src/app/api/config/{fee-percentile,tx-timeout,gas-estimate,quote-guard,leaderboard-poll}/route.ts`
- `src/app/api/analytics/leaderboard/{route,efficiency-leaders,rising-stars,volume-leaders}/route.ts`
- `src/app/api/analytics/{transactions,swap-count,volume/swap,active-traders,l1-swap-hashes}/route.ts`
- `src/app/api/gate/warm/route.ts`
- `src/app/api/og/preconfirm/{route.tsx,[time]/route.tsx}` (validate the `time` segment)
- `src/app/api/cron/update-edge-config/miles-estimate-gas/route.ts` (bearer-token header)

Input-free routes (lower priority, Zod is cosmetic):
- `src/app/api/users/route.ts` — lists users, no input
- `src/app/api/tokens/route.ts` — returns the token list

### God files — pending splits

All three are documented under "Pending splits" in
[`agent_docs/architecture.md`](./architecture.md). Split them AFTER seeding
component tests so regressions have an oracle.

- `src/components/dashboard/LeaderboardTable.tsx` (~2700 LoC) — extract
  `VolumeLeadersCard`, `EfficiencyLeadersCard`, `ReferralLeadersCard`,
  `RisingStarsCard`, `PaginatedLeaderboardModal`, `LeaderboardRow` into
  `src/components/dashboard/leaderboard/`. The pure `paginate.ts` helper
  is already extracted and tested — use it as the template.
- `src/components/modals/SwapConfirmationModal.tsx` (~1160 LoC) — extract
  intent-path sub-components (wrap / unwrap / approve+swap) and a
  `useSwapConfirmationMachine` hook.
- `src/hooks/use-swap-form.ts` (~620 LoC) — extract the quote-cache and
  `computedMinAmountOut` math into sub-hooks/pure helpers first (both
  testable without React).

### Type tightening

`strict: false` + 54 `any` usages is the weakest layer of the codebase.
Incremental path:

1. Flip `noImplicitAny: true` in `tsconfig.json` and fix the fallout.
2. Convert detection-layer `any` (especially `src/lib/wallet-provider.ts`,
   8 occurrences) to `unknown` + narrowing; add suppression comments where
   the EIP-1193 shape is genuinely dynamic.
3. Revisit `strictNullChecks`. The `T | NextResponse` pattern in
   `@/lib/api/parse` was chosen because strict-null is off; once it's on,
   the discriminated-union form becomes usable again.

### Comment hygiene — remaining hotspots

Sweeping pass covered `wallet-provider.ts` and the ref-plumbing in
`use-swap-quote.ts`. Still worth a pass:

- `src/components/modals/SwapConfirmationModal.tsx` — three snapshot refs
  (`live`, `snapshot`, `effective`). Add a WHY about when each tier wins.
- `src/hooks/use-swap-form.ts` — the 40-line `minAmountOut` computation
  mixes treasury margin with Barter floor. Inline the rules.
- `src/lib/analytics/queries.ts` (662 LoC) — a second candidate for
  split-and-document; SQL queries benefit from a sentence each about
  invariants (table ordering, lowercased addresses, etc.).

### Test backlog (seed more oracles)

Highest-ROI tests to add next:

- `tests/hooks/use-swap-slippage.test.ts` — wrap the hook with
  `@testing-library/react`'s `renderHook`; test the clamp/round logic.
- `tests/lib/swap/permit2-utils.test.ts` — EIP-712 deadline + nonce math.
- `tests/hooks/use-quote-guard-config.test.ts` — edge-config threshold reads.
- `tests/components/dashboard/leaderboard/LeaderboardRow.test.tsx` — once
  the row is extracted as a standalone component.
