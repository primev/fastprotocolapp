# `src/app/api` — route index

52 Next.js route handlers organized by domain. This is the single
lookup table for "does this route already exist?" and "what does
`/api/foo` actually do?" — skim here before greping.

Zod migration status: **24 of 52 routes** use
`@/lib/api/{parse,schemas}`. Remaining routes are flagged with ⚠️
below and should be migrated when touched. See
`.claude/skills/next-app-router/api-routes.md` for the pattern.

---

## Analytics (Fast Protocol warehouse reads)

| Route                                       | Methods | Purpose                                           | Zod |
| ------------------------------------------- | ------- | ------------------------------------------------- | --- |
| `analytics/active-traders/`                 | GET     | 24h active-trader count                           | ⚠️  |
| `analytics/eth-price/`                      | GET     | Current ETH/USD for USD-denominated volume calcs  | ⚠️  |
| `analytics/l1-swap-hashes/`                 | GET     | List of on-chain tx hashes for a time window      | ⚠️  |
| `analytics/leaderboard/`                    | GET     | Main volume leaderboard (paginated)               | ⚠️  |
| `analytics/leaderboard/efficiency-leaders/` | GET     | Tx-count / streak leaderboard                     | ⚠️  |
| `analytics/leaderboard/find-me/`            | GET     | User's page + rank in leaderboard                 | ✅  |
| `analytics/leaderboard/rising-stars/`       | GET     | WoW-growth-based leaderboard                      | ⚠️  |
| `analytics/leaderboard/volume-leaders/`     | GET     | Volume-only leaderboard                           | ⚠️  |
| `analytics/swap-count/`                     | GET     | Total swap count                                  | ⚠️  |
| `analytics/transactions/`                   | GET     | Tx list with filters                              | ⚠️  |
| `analytics/user/[address]/`                 | GET     | User volume + tx counts (Fast RPC + analytics DB) | ✅  |
| `analytics/volume/swap/`                    | GET     | Aggregated swap volume                            | ⚠️  |

## Barter (external routing provider)

| Route           | Methods | Purpose                                                | Zod |
| --------------- | ------- | ------------------------------------------------------ | --- |
| `barter/route/` | POST    | Proxy to Barter `/route` — alternate-venue price quote | ✅  |

## Config (runtime feature toggles read from Vercel Edge Config)

| Route                      | Methods | Purpose                            | Zod |
| -------------------------- | ------- | ---------------------------------- | --- |
| `config/fee-percentile/`   | GET     | Dynamic fee-percentile value       | ⚠️  |
| `config/gas-estimate/`     | GET     | Miles-estimate gas-cost baseline   | ⚠️  |
| `config/leaderboard-poll/` | GET     | Leaderboard poll interval override | ⚠️  |
| `config/quote-guard/`      | GET     | Quote-guard divergence threshold   | ⚠️  |
| `config/tx-timeout/`       | GET     | Tx-confirmation timeout config     | ⚠️  |

## Cron (scheduled jobs run by Vercel Cron)

| Route                                         | Methods | Purpose                                                      | Zod |
| --------------------------------------------- | ------- | ------------------------------------------------------------ | --- |
| `cron/update-edge-config/miles-estimate-gas/` | POST    | Recompute miles-estimate gas baseline + write to Edge Config | ⚠️  |

## FastSwap (preconfirmation swap engine — talks to `tools/preconf-rpc` upstream)

| Route                        | Methods | Purpose                                                                       | Zod |
| ---------------------------- | ------- | ----------------------------------------------------------------------------- | --- |
| `fastswap/`                  | POST    | Submit Permit2-signed swap intent                                             | ✅  |
| `fast-tx-status/[hash]/`     | GET     | Preconf status from mctransactions (`preconfirmed`/`confirmed`/`failed`/null) | ✅  |
| `transaction-status/[hash]/` | GET     | Fast RPC `/status/{hash}` proxy                                               | ✅  |
| `fastswap-miles/by-address/` | GET     | User's recent swaps + miles (from StarRocks `fastswap_miles`)                 | ✅  |

## Feedback

| Route       | Methods | Purpose                                                 | Zod |
| ----------- | ------- | ------------------------------------------------------- | --- |
| `feedback/` | POST    | Speed feedback (yes/average/no) written to Google Sheet | ✅  |

## Fuul (external rewards SDK — miles + referrals)

| Route                       | Methods | Purpose                                           | Zod |
| --------------------------- | ------- | ------------------------------------------------- | --- |
| `fuul/identify-user/`       | POST    | `connect_wallet` event with tracking id           | ✅  |
| `fuul/leaderboard/`         | GET     | Miles + referrals leaderboard (server-side cache) | ✅  |
| `fuul/leaderboard/find-me/` | GET     | User's page + rank in Fuul leaderboard            | ✅  |
| `fuul/payouts/`             | GET     | Total user points (Fuul `/payouts/totals/{addr}`) | ✅  |
| `fuul/payouts-summary/`     | GET     | Global payouts summary                            | ✅  |

## Gate (whitelist + waitlist consolidated read)

| Route          | Methods | Purpose                                                             | Zod |
| -------------- | ------- | ------------------------------------------------------------------- | --- |
| `gate/status/` | GET     | Consolidated `{whitelisted, approved, onWaitlist, position, total}` | ✅  |
| `gate/warm/`   | GET     | Warms sheet caches (no-op status)                                   | ⚠️  |

## Hyperliquid (partner quest)

Legacy, **no longer routes** — the `.ts` files under `src/app/api/hyperliquid/` are helper imports, not route handlers.

## OG (dynamic social cards)

| Route                   | Methods | Purpose                         | Zod |
| ----------------------- | ------- | ------------------------------- | --- |
| `og/preconfirm/`        | GET     | Preconfirm share card (default) | ⚠️  |
| `og/preconfirm/[time]/` | GET     | Preconfirm share card with time | ⚠️  |

## Tokens

| Route          | Methods | Purpose                                    | Zod |
| -------------- | ------- | ------------------------------------------ | --- |
| `token-price/` | GET     | CoinGecko-backed token price lookup        | ✅  |
| `tokens/`      | GET     | Merged token list (Uniswap + app curation) | ⚠️  |

## User community activity (partner quest tracking)

| Route                                                | Methods   | Purpose                                   | Zod |
| ---------------------------------------------------- | --------- | ----------------------------------------- | --- |
| `user-community-activity/[wallet_address]/`          | GET, POST | Per-wallet latest activity per entity     | ✅  |
| `user-community-activity/[wallet_address]/[entity]/` | GET       | Latest activity for a specific entity     | ✅  |
| `user-community-activity/entity/[entity]/`           | GET       | All users who have activity for an entity | ✅  |
| `user-community-activity/entities/`                  | GET       | List of distinct entities                 | ⚠️  |
| `user-community-activity/stats/`                     | GET       | Aggregate stats                           | ⚠️  |

## User onboarding

| Route                               | Methods        | Purpose                                        | Zod |
| ----------------------------------- | -------------- | ---------------------------------------------- | --- |
| `user-onboarding/[wallet_address]/` | GET, POST, PUT | Onboarding step completion (7 boolean columns) | ✅  |
| `users/`                            | GET            | List recent users                              | ⚠️  |

## Waitlist

| Route                     | Methods   | Purpose                                  | Zod |
| ------------------------- | --------- | ---------------------------------------- | --- |
| `early-access/`           | POST      | Submit waitlist entry (wallet + socials) | ✅  |
| `waitlist/accept-invite/` | GET, POST | Check or mark accepted-invite flag       | ✅  |
| `waitlist/check/`         | GET       | Whether a wallet is on the waitlist      | ✅  |
| `waitlist/count/`         | GET       | Total waitlist count                     | ⚠️  |
| `waitlist/list/`          | GET       | Full waitlist (admin view)               | ⚠️  |
| `waitlist/position/`      | GET       | Wallet's position in waitlist            | ✅  |

## Whitelist

| Route                                      | Methods | Purpose                               | Zod |
| ------------------------------------------ | ------- | ------------------------------------- | --- |
| `whitelist/check/`                         | GET     | Whether a wallet is whitelisted       | ✅  |
| `whitelist/convert-waitlist-to-whitelist/` | POST    | Admin: promote waitlist → whitelist   | ⚠️  |
| `whitelist/generate/`                      | GET     | Admin: generate a new whitelist       | ⚠️  |
| `whitelist/list/`                          | GET     | Full whitelist (admin view)           | ⚠️  |
| `whitelist/whitelist-swap-volume-holders/` | POST    | Admin: whitelist based on swap volume | ⚠️  |

---

## Add a new route

1. Create `src/app/api/<name>/route.ts`.
2. Use the Zod pattern from
   [`.claude/skills/next-app-router/api-routes.md`](../../../.claude/skills/next-app-router/api-routes.md)
   — `parseJson` / `parseSearchParams` / `parseParams` from
   `@/lib/api/parse`.
3. If the route takes user input, the validation schema must use
   primitives from `@/lib/api/schemas` (wallet, txHash, tokenSymbol,
   pagination) — add a new shared primitive before inventing a
   route-local one.
4. Add a row to this README. Sort by domain.
5. Land a test under `tests/api/<name>.test.ts` if the route hits
   pg-mem-testable surface.
