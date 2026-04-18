# Architecture

Directory map with callouts for files you'll actually touch. Prefer reading the
file when you need details — this is a navigation aid.

## `src/app/` — Next.js App Router

```
src/app/
├── (app)/                     # Route group — main authenticated app shell
├── api/                       # ~20 API routes (see list below)
├── claim/                     # SBT claim flow
├── early-access/              # Waitlist / gated entry
├── learn/                     # Educational content (MDX)
├── network-checker/           # RPC health check
├── referral/                  # Referral landing
├── s/                         # Short-link handler
├── share/                     # Share card generator
├── layout.tsx                 # Root layout, providers
├── globals.css                # Tailwind layer + design tokens
├── not-found.tsx
├── icon.png / opengraph-image.png
├── og/                        # Dynamic OG image endpoints
├── robots.ts / sitemap.ts     # Next metadata
└── middleware.ts              # (in src/, not app/) — request middleware
```

### `src/app/api/` endpoints

`analytics · barter · config · cron · early-access · fast-tx-status · fastswap · fastswap-miles · feedback · fuul · gate · hyperliquid · og · token-price · tokens · transaction-status · user-community-activity · user-onboarding · users · waitlist · whitelist`

Routes that accept user input now go through `@/lib/api/parse` + Zod schemas in
`@/lib/api/schemas`. See the `next-app-router` skill for the pattern.

## `src/components/` — by domain

```
claim/          dashboard/      landing/        learn/
modals/         network-checker onboarding/     pwa/
referral/       shared/         swap/           ui/          (shadcn)
AnimatedBackground.tsx  NavLink.tsx  providers.tsx
```

- `providers.tsx` wires wagmi, RainbowKit, TanStack Query, theme.
- `components/ui/` is shadcn — only edit for design-system-wide changes; local
  variants go in `components/shared/`.
- `components/dashboard/leaderboard/` hosts extracted pure helpers + seeds for
  future sub-card splits (see "Pending splits" below).

## `src/hooks/` — 50 custom hooks

All hooks live flat in `src/hooks/`. `src/hooks/index.ts` is a full barrel
(`export *` across every hook), so `@/hooks` is the single discoverable entry
point. Deep imports still work for bundler friendliness.

Groupings (filenames are self-documenting):

- **Swap**: `use-swap-form`, `use-swap-quote`, `use-swap-intent`,
  `use-swap-slippage`, `use-swap-confirmation`, `use-weth-wrap-unwrap`
- **Permit2**: `use-permit2-allowance`, `use-permit2-nonce`
- **Wallet/RPC**: `use-wallet-connection`, `use-wallet-info`,
  `use-wallet-provider`, `use-rpc-setup`, `use-rpc-test`,
  `use-network-installation`, `use-smart-account-detection`,
  `use-add-fast-to-metamask`
- **Balances/tokens**: `use-token-balances`, `use-token-price`,
  `use-recent-tokens`, `use-balance-flash`
- **Dashboard**: `use-dashboard-data`, `use-prefetch-dashboard`,
  `use-dashboard-tasks`, `use-user-points`, `use-user-swaps`
- **Leaderboard/miles**: `use-leaderboard-data`, `use-estimated-miles`,
  `use-fuul-miles-leaderboard`, `use-surplus-rate`
- **Onboarding/gating**: `use-user-onboarding`, `use-onboarding-steps`,
  `use-gate-status`, `use-whitelist`, `use-waitlist`, `use-waitlist-position`,
  `use-affiliate-code`, `use-accepted-invite`
- **SBT/mint**: `use-genesis-sbt`, `use-minting`
- **Email**: `use-email-capture`, `use-email-dialog`
- **Tx**: `use-wait-for-tx-confirmation`, `use-broadcast-gas-price`,
  `use-eth-path-gas-estimate`
- **Utility**: `use-mobile`, `use-toast`, `use-page-active`, `use-page-prefetch`,
  `use-barter-validation`, `use-read-only-contract-call`, `use-quote-guard-config`

## `src/lib/` — utilities, configs, and domain logic

Folderized into four domain groupings plus a handful of top-level modules that
span categories:

```
src/lib/
├── api/                  # Zod schemas + request parsing helpers
│   ├── parse.ts          # parseJson / parseSearchParams / parseParams
│   └── schemas.ts        # walletAddressSchema, txHashSchema, tokenSymbolSchema, pagination
├── tokens/               # token data + ERC-20 / WETH ABIs
│   ├── erc20-abi.ts / weth-abi.ts / weth-utils.ts
│   ├── token-icons.ts / token-resolver.ts / popular-tokens.ts
│   ├── barter-supported-tokens.ts
│   ├── stablecoins.ts / stablecoin-list.json / token-list.json
├── swap/                 # swap engine
│   ├── constants.ts / events.ts / server.ts
│   ├── quote-guard.ts / permit2-utils.ts / eth-path-tx.ts / barter-api.ts
│   └── token-list.ts     # (formerly swap-logic/token-list.ts)
├── settlement/           # Fast protocol chain + tx layer
│   ├── rpc-status.ts / tx-status.ts / db.ts
│   ├── preconfirm-sound.ts
│   ├── tx-config.ts
│   └── transaction-errors.ts / transaction-receipt-utils.ts
├── config/               # runtime config + feature flags
│   ├── site.ts / network.ts / leaderboard.ts / feature-flags.ts / constants.ts
├── analytics/            # SQL services + query registry (unchanged by the reorg)
├── analytics-server.ts
├── contract-config.tsx / contract-server.ts   # Genesis SBT ABI + helpers
├── fuul.ts               # side-effect Fuul SDK init (imported without `from`)
├── wagmi.ts              # chain configs, connectors, transports
├── wallet-provider.ts    # browser wallet detection (Brave/Rabby/MM ordering)
├── google-sheets.ts / waitlist-sheet-cache.ts
├── email.ts / vercel-edge-config.ts
├── gate-data.ts / onboarding-utils.ts / learn.ts
├── miles-events.ts
└── utils.ts              # classic cn() + formatters
```

Import cost: the folderize kept the `@/lib/…` alias shape, just one level
deeper. Grep for the new path when you move a module. Nothing imports the old
flat names anymore.

## `src/env/`, `src/stores/`, `src/actions/`, `src/types/`

- `env/server.ts` — t3-oss env validation (server + client vars).
- `stores/swapToastStore.ts` — Zustand store for swap toasts.
- `actions/capture-email.ts` — server action.
- `types/swap.ts` — swap-flow types.

## Tests

Top-level `tests/` mirrors `src/`. See `tests/README.md` and
`agent_docs/testing.md` for conventions. The `post-edit-test.sh` hook looks
up `tests/<mirror>.test.*` first on each source edit.

## Contracts

- `contracts/` — Foundry project (src, test, script, lib). Do **not** edit
  without human review.
- `contracts-abi/` — Extracted ABI types + Go clients. `abi/` is the
  authoritative ABI directory consumed by `src/lib/contract-config.tsx`.
- `.gitmodules` indicates git submodules for contract deps.

> **Removed (unused).** The former `src/lib/fast-settlement-v2-1.ts` (493 LoC)
> and `src/lib/fast-settlement-v3-abi.ts` had no runtime imports anywhere in
> `src/` and were deleted. The FastSettlement V3 struct types the app needs
> (`SwapIntent`, `SwapCall`, `PermitTransferFrom`) live in `src/types/swap.ts`.

## Docs layers

- `docs/` — human-facing deep-dives (5 files), each banner-gated as
  "Audience: humans" with a link to the authoritative skill.
- `agent_docs/` — this folder; concise references for agents.
- `.claude/skills/` — how-to for agents, loaded on relevance.

See `.claude/README.md` for the full convention.

## Pending splits (god files)

These files remain large and are candidates for future extraction. The safe
split seams are marked below; each should happen after seeding component tests
so regressions have an oracle.

- **`src/components/dashboard/LeaderboardTable.tsx` (≈2700 LoC)** — split into:
  - `leaderboard/VolumeLeadersCard.tsx` (≈290 LoC block around line 1700)
  - `leaderboard/EfficiencyLeadersCard.tsx` (≈290 LoC)
  - `leaderboard/ReferralLeadersCard.tsx` (≈200 LoC)
  - `leaderboard/RisingStarsCard.tsx` (≈240 LoC)
  - `leaderboard/PaginatedLeaderboardModal.tsx` (≈300 LoC)
  - `leaderboard/LeaderboardRow.tsx` (≈140 LoC)
  - `leaderboard/paginate.ts` (buildPageNumbers, PAGE_SIZE) — **DONE**, tested.
- **`src/components/modals/SwapConfirmationModal.tsx` (≈1160 LoC)** — split
  into intent-path sub-components (wrap / unwrap / approve+swap) and a
  `useSwapConfirmationMachine` hook.
- **`src/hooks/use-swap-form.ts` (≈620 LoC)** — extract the quote-cache and
  `computedMinAmountOut` math into sub-hooks/pure helpers first (both are
  testable without React).
