# Architecture

Directory map with callouts for files you'll actually touch. Prefer reading the file when you need details — this is a navigation aid.

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

## `src/components/` — by domain

```
claim/          dashboard/      landing/        learn/
modals/         network-checker onboarding/     pwa/
referral/       shared/         swap/           ui/          (shadcn)
AnimatedBackground.tsx  NavLink.tsx  providers.tsx
```

- `providers.tsx` wires wagmi, RainbowKit, TanStack Query, theme.
- `components/ui/` is shadcn — only edit for design-system-wide changes; local variants go in `components/shared/`.

## `src/hooks/` — 50+ custom hooks

Grouped by concern (filenames are self-documenting):

- **Swap**: `use-swap-form`, `use-swap-quote`, `use-swap-intent`, `use-swap-slippage`, `use-swap-confirmation`, `use-weth-wrap-unwrap`
- **Permit2**: `use-permit2-allowance`, `use-permit2-nonce`
- **Wallet/RPC**: `use-wallet-connection`, `use-wallet-info`, `use-wallet-provider`, `use-rpc-setup`, `use-rpc-test`, `use-network-installation`, `use-smart-account-detection`, `use-add-fast-to-metamask`
- **Balances/tokens**: `use-token-balances`, `use-token-price`, `use-recent-tokens`, `use-balance-flash`
- **Dashboard**: `use-dashboard-data`, `use-prefetch-dashboard`, `use-dashboard-tasks`, `use-user-points`, `use-user-swaps`
- **Leaderboard/miles**: `use-leaderboard-data`, `use-estimated-miles`, `use-fuul-miles-leaderboard`, `use-surplus-rate`
- **Onboarding/gating**: `use-user-onboarding`, `use-onboarding-steps`, `use-gate-status`, `use-whitelist`, `use-waitlist`, `use-waitlist-position`, `use-affiliate-code`, `use-accepted-invite`
- **SBT/mint**: `use-genesis-sbt`, `use-minting`
- **Email**: `use-email-capture`, `use-email-dialog`
- **Tx**: `use-wait-for-tx-confirmation`, `use-broadcast-gas-price`, `use-eth-path-gas-estimate`
- **Utility**: `use-mobile`, `use-toast`, `use-page-active`, `use-page-prefetch`, `use-barter-validation`, `use-read-only-contract-call`, `use-quote-guard-config`

Barrel export: `src/hooks/index.ts`.

## `src/lib/` — utilities, configs, and domain logic

High-traffic files:

- `wagmi.ts` — chain configs, connectors, transports (wagmi core)
- `wallet-provider.ts` — low-level wallet provider helpers
- `contract-config.tsx` — contract addresses + ABI bindings for the app
- `contract-server.ts` — server-side contract call helpers
- `fast-rpc-status.ts` — Fast RPC health
- `fast-settlement-v2-1.ts` / `fast-settlement-v3-abi.ts` — settlement contract surfaces
- `fast-tx-status.ts` — Fast-specific tx status polling
- `swap-logic/` — the swap engine
- `swap-events.ts` · `swap-constants.ts` · `swap-server.ts`
- `quote-guard.ts` — slippage / staleness guards around quotes
- `permit2-utils.ts` — permit2 signature + deadline helpers
- `weth-abi.ts` · `weth-utils.ts` — WETH wrap/unwrap
- `erc20-abi.ts` — standard ERC-20 ABI
- `eth-path-tx.ts` — ETH-path transaction construction
- `transaction-errors.ts` · `transaction-receipt-utils.ts` · `tx-config.ts`
- `token-resolver.ts` · `popular-tokens.ts` · `token-icons.ts` · `token-list.json` · `stablecoin-list.json` · `stablecoins.ts`
- `barter-api.ts` · `barter-supported-tokens.ts` — Barter integration
- `fuul.ts` · `miles-events.ts` — Fuul (miles)
- `leaderboard-config.ts` — leaderboard tier config
- `feature-flags.ts` — runtime feature flags (e.g., `show_miles_estimate`)
- `gate-data.ts` — gating logic
- `site-config.ts` · `network-config.ts` · `constants.ts`
- `preconfirm-sound.ts` — UI sfx for preconfirm
- `fast-db.ts` — Fast RPC DB client
- `google-sheets.ts` · `waitlist-sheet-cache.ts` — waitlist
- `email.ts` — EmailOctopus
- `vercel-edge-config.ts` — edge config reads
- `onboarding-utils.ts`
- `analytics/` + `analytics-server.ts`
- `utils.ts` — classic `cn()` + general helpers
- `__tests__/` — unit tests colocated under lib

## `src/env/`, `src/stores/`, `src/actions/`, `src/test/`, `src/types/`

- `env/server.ts` — t3-oss env validation (server + client vars)
- `stores/swapToastStore.ts` — Zustand store for swap toasts
- `actions/capture-email.ts` — server action
- `test/utils/` — vitest test helpers
- `types/swap.ts` — swap-flow types

## Contracts

- `contracts/` — Foundry project (src, test, script, lib). Do **not** edit without human review.
- `contracts-abi/` — Extracted ABI types + Go clients. `abi/` is the authoritative ABI directory consumed by `src/lib/contract-config.tsx`.
- `.gitmodules` indicates git submodules for contract deps.

## Docs layers

- `docs/` — human-facing deep-dives (5 files). Linked from relevant skills.
- `agent_docs/` — this folder; concise references for agents.
