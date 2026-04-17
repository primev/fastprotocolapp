# Edge Config

Runtime configuration values stored in [Vercel Edge Config](https://vercel.com/docs/storage/edge-config). Read at the edge with ~0ms latency — no cold starts, no database round-trips.

Values can be changed in the Vercel dashboard without a deploy. The frontend reads them via internal API routes (`/api/config/*`), cached 60s with 5-minute stale-while-revalidate.

## Keys

### `authorized_wallets`

- **Type:** `string[]`
- **Used by:** `src/middleware.ts`
- **Purpose:** Wallet addresses authorized to bypass gating or access restricted features. Checked in middleware before route handlers execute.

### `tx_confirmation_timeout_ms`

- **Type:** `number`
- **Default:** `60000` (60 seconds)
- **Used by:** `src/hooks/use-wait-for-tx-confirmation.ts` via `/api/config/tx-timeout`
- **Purpose:** Maximum time (ms) to wait for a transaction to be preconfirmed or confirmed before giving up and showing an error. Increase if network is congested and preconfirmations are slow.

### `leaderboard_poll_interval_ms`

- **Type:** `number`
- **Default:** `15000` (15 seconds)
- **Used by:** `src/hooks/use-fuul-miles-leaderboard.ts` via `/api/config/leaderboard-poll`
- **Purpose:** How often the leaderboard refetches miles data. Lower values mean fresher data but more API load on the Fuul endpoint.

### `miles_estimate_gas_limit_average`

- **Type:** `number`
- **Default:** `450000`
- **Updated by:** Daily cron (`/api/cron/update-edge-config/miles-estimate-gas`)
- **Used by:** `src/hooks/use-estimated-miles.ts` via `/api/config/gas-estimate`
- **Purpose:** Average gas limit across recent FastSwap transactions. Used in the miles estimation formula to calculate bid cost. Updated daily from the last 200 on-chain transactions.

### `miles_estimate_gas_used_average`

- **Type:** `number`
- **Default:** `180000`
- **Updated by:** Daily cron (`/api/cron/update-edge-config/miles-estimate-gas`)
- **Used by:** `src/hooks/use-estimated-miles.ts` via `/api/config/gas-estimate`
- **Purpose:** Average gas actually consumed per FastSwap transaction. Used alongside gas limit to refine the miles estimate. Updated daily.

### `miles_estimate_surplus_rate`

- **Type:** `number`
- **Default:** `0.0056`
- **Updated by:** Daily cron (`/api/cron/update-edge-config/miles-estimate-gas`)
- **Used by:** `src/hooks/use-surplus-rate.ts` via `/api/config/gas-estimate`
- **Purpose:** p25 surplus rate (ETH per unit output) observed across recent swaps. Controls how aggressively the miles estimator credits MEV redistribution. Updated daily.

### `miles_estimate_fee_percentile`

- **Type:** `number`
- **Default:** `55`
- **Used by:** `src/hooks/use-estimated-miles.ts` via `/api/config/fee-percentile`
- **Purpose:** Percentile of recent priority fees used to estimate the bid cost component of miles. Higher values are more conservative (assume higher fees, estimate fewer miles).

### `quote_guard_divergence_threshold_pct`

- **Type:** `number`
- **Default:** `25`
- **Used by:** `src/lib/quote-guard.ts` via `/api/config/quote-guard`
- **Purpose:** Maximum allowed percentage divergence between Barter and Uniswap quotes before the guard rejects the quote. Prevents the user from executing a swap where the two pricing sources disagree significantly — protects against stale or manipulated quotes.

### `quote_guard_treasury_margin_pct`

- **Type:** `number`
- **Default:** `1.5`
- **Used by:** `src/lib/quote-guard.ts` via `/api/config/quote-guard`
- **Purpose:** Additional margin (%) added to the treasury's side of the quote guard calculation. Accounts for gas costs and executor overhead that the treasury absorbs. Increasing this makes the guard more permissive.

### `pro_mode_min_usd`

- **Type:** `number`
- **Default:** `250`
- **Used by:** `src/components/swap/SwapForm.tsx` via `/api/config/pro-threshold`
- **Purpose:** Minimum sell-side USD value required for Pro mode (top 10% block placement) to auto-engage. Swaps below this threshold don't qualify — the backend doesn't enforce this yet, so the frontend gates it. Change this to adjust who gets Pro mode without a deploy.

## Adding a new key

1. Set the value in the [Vercel Edge Config dashboard](https://vercel.com/dashboard/stores)
2. Create an API route at `src/app/api/config/<name>/route.ts` (use `export const runtime = "edge"` and `get()` from `@vercel/edge-config`)
3. Create a client hook or utility in `src/hooks/` that fetches from the route and falls back to a hardcoded default
4. Use the hook in your component — never read edge config directly from client code

If the value should update automatically, add a cron job at `src/app/api/cron/update-edge-config/<name>/route.ts` and register it in `vercel.json`.
