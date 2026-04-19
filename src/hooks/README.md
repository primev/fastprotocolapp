# `src/hooks` — hook index

50 custom hooks. Grouped by concern below. The barrel at `index.ts`
re-exports every hook via `export *`, so `import { useX } from
"@/hooks"` works for any of them.

Naming convention: `use-kebab-case.ts`. Tests mirror at
`tests/hooks/use-<name>.test.ts` (see `tests/hooks/use-swap-slippage.test.ts`
for the happy-dom pattern).

---

## Swap flow (the engine)

| Hook                     | Purpose                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `use-swap-form`          | Top-level form state — tokens, amounts, inversion, slippage plumbing |
| `use-swap-quote`         | Uniswap V3 quoter with fee-tier parallel fetch + slippage math       |
| `use-swap-intent`        | Builds and EIP-712-signs the Permit2 witness intent                  |
| `use-swap-confirmation`  | Modal orchestration — approval → auto-swap sequencing                |
| `use-swap-slippage`      | Clamp / round / persist slippage + deadline settings                 |
| `use-weth-wrap-unwrap`   | ETH ↔ WETH wrap/unwrap direct-contract path (bypasses Uniswap)       |
| `use-barter-validation`  | Cross-references Barter quote as sanity check on Uniswap quote       |
| `use-quote-guard-config` | Fetches quote-divergence threshold from Edge Config                  |

## Permit2

| Hook                    | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `use-permit2-allowance` | Read / revoke Permit2 allowance                     |
| `use-permit2-nonce`     | Fetch next Permit2 nonce for a given signer + token |

## Wallet + RPC plumbing

| Hook                          | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `use-wallet-connection`       | High-level connect / disconnect / account state                    |
| `use-wallet-info`             | Display-side wallet metadata (name, icon, chain)                   |
| `use-wallet-provider`         | Low-level browser-wallet detection (Brave → Rabby → MM → Coinbase) |
| `use-rpc-setup`               | Adds Fast RPC to MetaMask / Rabby via `wallet_addEthereumChain`    |
| `use-rpc-test`                | Health-check Fast RPC reachability + chain-id match                |
| `use-network-installation`    | Orchestrates the network-installation drawer state machine         |
| `use-smart-account-detection` | Detects smart-contract wallets (ERC-4337, etc.)                    |
| `use-add-fast-to-metamask`    | One-click Fast RPC add with MetaMask-specific deep link            |

## Token balances + prices

| Hook                 | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `use-token-balances` | Alchemy-backed ERC-20 balance fetch for the account |
| `use-token-price`    | Single-token USD price (CoinGecko proxy)            |
| `use-recent-tokens`  | localStorage-backed "recently used" token list      |
| `use-balance-flash`  | UI effect when a balance changes                    |

## Transactions

| Hook                           | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `use-wait-for-tx-confirmation` | Race Fast RPC `/status/` polling vs wagmi on-chain receipt |
| `use-broadcast-gas-price`      | Gas-price + priority-fee suggestion for tx construction    |
| `use-eth-path-gas-estimate`    | Gas estimate for ETH-path (native ETH input) swaps         |

## Dashboard + user data

| Hook                     | Purpose                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `use-dashboard-data`     | Consolidated TanStack Query hooks for dashboard reads                    |
| `use-dashboard-tasks`    | Derives task state from onboarding + activity                            |
| `use-user-points`        | Fuul total-points fetch                                                  |
| `use-user-swaps`         | User's recent swap list                                                  |
| `use-user-onboarding`    | Onboarding-step read/write via `/api/user-onboarding`                    |
| `use-prefetch-dashboard` | Prefetches dashboard data on route entry                                 |
| `use-page-prefetch`      | Prefetches arbitrary routes on link hover                                |
| `use-page-active`        | Combines tab-visibility + user-idle into a single "is user here?" signal |

## Leaderboard + miles

| Hook                         | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `use-leaderboard-data`       | Main leaderboard query (volume + tiers)                   |
| `use-fuul-miles-leaderboard` | Fuul-backed miles leaderboard                             |
| `use-estimated-miles`        | Pre-swap miles-reward estimate (slippage + gas + surplus) |
| `use-surplus-rate`           | Realized MEV surplus rate from recent swaps               |

## Onboarding + gating

| Hook                    | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `use-onboarding-steps`  | Step-state machine for the onboarding flow                 |
| `use-gate-status`       | Consolidated whitelist + waitlist + accepted-invite status |
| `use-whitelist`         | Whitelist check (fallback when gate-status isn't loaded)   |
| `use-waitlist`          | Waitlist submission                                        |
| `use-waitlist-position` | User's position in waitlist                                |
| `use-affiliate-code`    | Affiliate code URL parsing + persistence                   |
| `use-accepted-invite`   | Accepted-invite flag for the banner                        |

## SBT / minting

| Hook              | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `use-genesis-sbt` | Reads Genesis SBT state (owned / tier / metadata) |
| `use-minting`     | Mint-flow orchestration (tx submission + waiting) |

## Email

| Hook                | Purpose                              |
| ------------------- | ------------------------------------ |
| `use-email-capture` | EmailOctopus-backed email submission |
| `use-email-dialog`  | Email-capture modal state            |

## Utility

| Hook                          | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `use-toast`                   | Toast queue (shadcn/ui toast primitive)                       |
| `use-mobile`                  | Viewport breakpoint detection                                 |
| `use-read-only-contract-call` | Generic `readContract` wrapper with TanStack Query cache keys |

---

## Add a new hook

1. Create `src/hooks/use-<name>.ts` (TypeScript, `"use client"` if it
   touches React state or browser APIs).
2. Add it to the `export *` block in `src/hooks/index.ts` (keep alphabetical).
3. Add a row to this README under the right domain.
4. Add a test at `tests/hooks/use-<name>.test.ts` if the hook has
   non-trivial logic (happy-dom environment, see `use-swap-slippage.test.ts`).
