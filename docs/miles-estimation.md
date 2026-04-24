# Fast Miles Estimation

Estimated miles are calculated pre-swap to show users how many Fast Miles they'll earn. The estimate appears in the swap form (`RewardsBadge`) and the confirmation modal.

Gated by `FEATURE_FLAGS.show_miles_estimate`. Implementation lives in `src/hooks/use-estimated-miles.ts`.

> **Important — slippage is currently NOT a factor in the estimate.** The
> `slippage` parameter is passed into `useEstimatedMiles` and lives in its
> `useMemo` dep array, but the calculation never reads it. The MEV pot is
> sized off a fixed `surplusRate` from Edge Config, not the user's tolerance.
> This means the >5% slippage warning copy ("You will earn more miles…")
> currently overstates what the displayed estimate will reflect. See
> [Known disconnects](#known-disconnects) below.

---

## Formula (as implemented)

```
mev_pot_eth         = surplus_rate × output_amount_in_eth
bid_cost_eth        = priority_fee × avg_gas_limit  / 1e18
gas_cost_eth        = base_fee     × avg_gas_used   / 1e18    (permit path only)

sweep_multiplier    = 1   if output is ETH
                    = 2.5 if output is any other token

total_bid_cost      = bid_cost_eth × sweep_multiplier
total_gas_cost      = gas_cost_eth × sweep_multiplier

net_mev_eth         = mev_pot_eth − total_bid_cost − total_gas_cost
user_mev_eth        = max(0, net_mev_eth) × 0.9
estimated_miles     = floor(user_mev_eth × 100,000)
```

If `estimated_miles < 1`, the UI shows **"Swap too small to earn miles"**.

### Inputs and where they come from

| Input | Source | Default | Refresh |
|-------|--------|---------|---------|
| `surplus_rate` | Edge Config (`miles_estimate_surplus_rate`) — p25 of `surplus / user_amt_out` across processed swaps over the last 30 days | `0.0056` (0.56%) | Daily, by `miles-estimate-gas` cron |
| `priority_fee` | FastRPC `mevcommit_estimateBidPricePerGas` — same value the bidder uses for actual bids | — (must be fetched) | Polled every 12s (`BID_ESTIMATE_POLL_MS`) |
| `base_fee` | `useBroadcastGasPrice` (latest L1 block) | — | Polled with new blocks |
| `avg_gas_limit` | Edge Config (`gasEstimate`) | `450_000` | Daily, by cron |
| `avg_gas_used` | Edge Config (`gasUsedEstimate`) — used **only** on permit path for the gas-cost term | `180_000` | Daily, by cron |
| `output_amount_in_eth` | If output is ETH/WETH: used directly. Otherwise: `amountOut × toTokenPriceUSD / ethPriceUSD` | — | Per quote |
| `0.9` (`USER_MEV_SHARE`) | Constant — user receives 90% of captured MEV | — | — |
| `100_000` (`MILES_PER_ETH`) | Constant — 1 mile = 0.00001 ETH | — | — |

### Why `gas_limit` and `gas_used` are different

- **Bid cost** is computed from `priorityFee × avgGasLimit` because the mev-commit bid is `priorityFee × txn.Gas()` — the protocol commits to paying for the gas *limit* of the transaction, not the gas it actually ends up using.
- **Gas cost** (permit path only) is computed from `baseFee × avgGasUsed` because the relayer is reimbursed for actual gas consumed, not the limit.

Mixing them up — e.g. using `avgGasLimit` for the gas-cost term — overstates the deduction and pushes miles negative on swaps that should earn.

### Path differences

- **ETH path** (user sells ETH → ERC-20): user pays L1 gas from their own wallet, so `gas_cost_eth = 0`. Only the bid cost is deducted.
- **Permit path** (user sells ERC-20): the relayer pays L1 gas and is reimbursed from MEV, so both `bid_cost_eth` and `gas_cost_eth` are deducted.

### Why the 2.5× sweep multiplier exists

Non-ETH output goes through a batched fastswap with a sweep transaction. At current volume, batches are effectively size-1, so each user eats the whole sweep gas share. The realized `(bid + sweep_overhead) / bid` ratio swings widely day-to-day (p50 ranged 0.9–2.9 over the recent 10-day window the multiplier was tuned against); 2.5× covers the median of "bad" days while staying tolerable on cheap days.

This is a known bandaid. The TODO in `use-estimated-miles.ts:182` is to replace it with an Edge Config-driven sweep overhead term computed from `surplus_eth − net_profit_eth − bid_cost` on recent finalized rows — same pattern as `miles_estimate_surplus_rate`.

---

## Worked example: 10 USDC → ETH (permit path)

Selling 10 USDC for ~0.004696 ETH at current rates.

```
Inputs (defaults):
  output_amount_in_eth = 0.004696          (since output is ETH)
  surplus_rate         = 0.0056            (Edge Config default)
  priority_fee         = 0.1 gwei = 1e8 wei
  base_fee             = 1.16 gwei
  avg_gas_limit        = 450,000
  avg_gas_used         = 180,000
  isEthOutput          = true              (sweep_multiplier = 1)
  isPermitPath         = true

Step 1 — MEV pot:
  mev_pot              = 0.0056 × 0.004696
                       = 0.0000263 ETH

Step 2 — Bid cost:
  bid_cost             = 1e8 × 450,000 / 1e18
                       = 0.000045 ETH

Step 3 — Gas cost (permit path):
  gas_cost             = 1.16e9 × 180,000 / 1e18
                       = 0.000209 ETH

Step 4 — Net MEV (ETH output → no sweep multiplier):
  net_mev              = 0.0000263 − 0.000045 − 0.000209
                       = −0.000228 ETH

Step 5 — Miles:
  net_mev < 0 → estimated_miles = 0
  UI shows: "Swap too small to earn miles"
```

For a 10 USDC permit-path swap, gas alone (~$0.42) far exceeds the modeled MEV pot (~$0.05). Below ~0.05 ETH of output, permit-path swaps don't earn.

### Break-even (back-of-envelope)

To earn **at least 1 mile**, `user_mev_eth ≥ 1 / 100,000`, so `net_mev_eth ≥ 0.0000111 ETH`.

**Permit path, ETH output** (typical "sell stablecoin → ETH"):

```
min_output_eth ≈ (gas_cost + bid_cost + 0.0000111) / surplus_rate
              ≈ (0.000209 + 0.000045 + 0.0000111) / 0.0056
              ≈ 0.0473 ETH                     (~$95 at $2,000/ETH)
```

**Permit path, non-ETH output** (sell stablecoin → other token, sweep applies):

```
min_output_eth ≈ (2.5 × (gas_cost + bid_cost) + 0.0000111) / surplus_rate
              ≈ (2.5 × 0.000254 + 0.0000111) / 0.0056
              ≈ 0.115 ETH                      (~$230)
```

**ETH path** (sell ETH → token; user pays own gas, no gas-cost deduction):

```
min_output_eth ≈ (sweep × bid_cost + 0.0000111) / surplus_rate
              ≈ (2.5 × 0.000045 + 0.0000111) / 0.0056
              ≈ 0.022 ETH                      (~$44)
```

These thresholds shift with priority/base fee, surplus rate, and (less directly) ETH price.

---

## Known disconnects

### 1. Slippage is documented as an input but doesn't affect the estimate

`useEstimatedMiles` accepts `slippage` and includes it in the memo's dep array (causing a recompute when it changes), but **the value is never read inside the calculation**. The MEV pot uses `surplusRate × outputInEth`, where `surplusRate` is the historical Edge Config value.

The settings popover's `>5%` warning copy says:

> Slippage above 5% is unusual. **You will earn more miles**, but will likely receive less tokens.

That promise isn't reflected in the displayed estimate today — moving slippage from 0.5% to 50% leaves the Miles number unchanged (assuming `amountOut`, prices, and gas haven't moved).

To make the warning copy true, either:

- **Lower-effort fix:** soften the warning copy (e.g. "*may* earn more miles") so the UI doesn't promise behavior it doesn't model, or
- **Right fix:** make `mev_pot_eth` scale with the user's effective slippage (e.g. `min(slippage/100, surplus_rate) × outputInEth`, or a richer model derived from finalized swap cohorts grouped by `max_slippage_bp`). This needs StarRocks analysis to confirm the relationship before shipping a formula change.

### 2. Sweep multiplier is a constant

The 2.5× value is a hand-tuned proxy. Days when the realized overhead ratio runs hot (e.g. p50 ≈ 2.9) the estimate is optimistic; on cheap days it's conservative. Replacing this with a daily-refreshed Edge Config term (TODO at `use-estimated-miles.ts:182`) would close the gap.

---

## Implementation map

| Concern | File |
|---------|------|
| Estimation hook (formula, gas/surplus/bid fetches, recompute logic) | `src/hooks/use-estimated-miles.ts` |
| Feature flag | `src/lib/feature-flags.ts` → `show_miles_estimate` |
| Pre-swap UI badge | `src/components/swap/RewardsBadge.tsx` |
| Confirmation-modal display | `src/components/modals/SwapConfirmationModal.tsx` |
| Edge Config endpoint (gas/surplus refresh) | `src/app/api/config/gas-estimate/route.ts` |
| Edge Config writer (cron) | `src/app/api/cron/update-edge-config/miles-estimate-gas/route.ts` |
| Bid estimate RPC | `mevcommit_estimateBidPricePerGas` via `RPC_ENDPOINT` |

### Recompute discipline

The memo dep list is `[amountOut, slippage, enabled, gasReady, toTokenPrice, ethPrice, isEthOutput, isPermitPath]`. Gas data (`priorityFee`, `baseFee`) is read from refs inside the memo so the 12-second background poll doesn't trigger UI recomputations — only user-driven inputs (and the one-shot `gasReady` flip on first load) do.

`lastMilesRef` holds the last successful value so transient null states (e.g. price loading between switches) don't flash an empty Miles badge.
