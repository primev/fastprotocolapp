# Fast Miles Estimation

Estimated miles are calculated pre-swap to show users how many Fast Miles they'll earn. The estimate appears in the swap form (`RewardsBadge`) and the confirmation modal.

Gated by `FEATURE_FLAGS.show_miles_estimate`. Implementation lives in `src/hooks/use-estimated-miles.ts`.

The estimator mirrors the on-chain settlement architecture: the FastSettlement contract pays the user `userAmtOut` (their slippage floor) and retains `received − userAmtOut` as surplus, which is later credited as miles by the off-chain `fastswap-miles` cron. The UI's job is to predict that retained surplus from values available at quote time.

---

## Two-path formula

The estimator has a **preferred path** (slippage-aware, derived from Barter's routed output) and a **fallback path** (Edge-Config-driven historical rate). The preferred path runs whenever Barter validation has settled; the fallback covers the brief gap before validation completes and any case where Barter is unavailable.

### Preferred path: `barter-surplus`

```
userAmtOut_token   = uniswap_amount_out × (1 − slippage / 100)
surplus_token      = max(0, barter_pre_gas_output − userAmtOut_token)
mev_pot_eth        = convert_to_eth(surplus_token)
```

This mirrors the contract's `received − userAmtOut` (substituting Barter's pre-gas routed output for `received`, since `received` isn't known until post-execution). The two diverge by the small mid-flight pool drift between quote and L1 inclusion (~0.1–0.3% of the routed amount), which is small enough not to need an explicit discount.

### Fallback path: `edge-config-fallback`

```
mev_pot_eth        = surplus_rate × output_amount_in_eth
```

Used when Barter's `outputAmountPreGas` isn't available — typical cases: validation hasn't settled yet (~300ms after a quote arrives), Barter API outage, or `hasSufficientBalance` is false (wallet not connected / underfunded). `surplus_rate` is the Edge Config value (default `0.0056`, i.e. p25 of historical realized surplus rate over 30 days).

### Common deductions (both paths)

```
bid_cost_eth        = priority_fee × avg_gas_limit  / 1e18
gas_cost_eth        = base_fee     × avg_gas_used   / 1e18    (permit path only)

sweep_multiplier    = 1   if output is ETH/WETH
                    = 2.5 if output is any other token

total_bid_cost      = bid_cost_eth × sweep_multiplier
total_gas_cost      = gas_cost_eth × sweep_multiplier

net_mev_eth         = mev_pot_eth − total_bid_cost − total_gas_cost
user_mev_eth        = max(0, net_mev_eth) × 0.9
estimated_miles     = floor(user_mev_eth × 100,000)
```

If `estimated_miles < 1`, the UI shows **"Swap too small to earn miles"**.

The console log on every recompute reports which path fired:

```
[useEstimatedMiles] N miles | <ETH|permit> path | source=<barter-surplus|edge-config-fallback>
```

---

## Inputs and where they come from

| Input | Source | Default | Refresh |
|-------|--------|---------|---------|
| `barter_pre_gas_output` | `useBarterValidation` → proxy `/api/barter/route` returns `outputAmountPreGas` (Barter's raw routed output, regardless of path) | — | Per quote, with 300ms debounce |
| `slippage` | User's effective slippage tolerance (auto or custom mode) | 0.5% / 1% (auto) | Per user input |
| `surplus_rate` | Edge Config (`miles_estimate_surplus_rate`) — fallback only | `0.0056` | Daily, by `miles-estimate-gas` cron |
| `priority_fee` | FastRPC `mevcommit_estimateBidPricePerGas` — same value the bidder uses for actual bids | — (fetched) | Polled every 12s (`BID_ESTIMATE_POLL_MS`) |
| `base_fee` | `useBroadcastGasPrice` (latest L1 block) | — | Polled with new blocks |
| `avg_gas_limit` | Edge Config (`gasEstimate`) | `450_000` | Daily, by cron |
| `avg_gas_used` | Edge Config (`gasUsedEstimate`) — used **only** on permit path for the gas-cost term | `180_000` | Daily, by cron |
| `output_amount_in_eth` | If output is ETH/WETH: used directly. Otherwise: `amountOut × toTokenPriceUSD / ethPriceUSD` | — | Per quote |
| `0.9` (`USER_MEV_SHARE`) | Constant — user receives 90% of captured MEV | — | — |
| `100_000` (`MILES_PER_ETH`) | Constant — 1 mile = 0.00001 ETH | — | — |

---

## Why the on-chain architecture makes this formula work

`tools/preconf-rpc/fastswap/fastswap.go` calls Barter with `MinReturnFraction = 1 − slippage/100`, recipient set to the **FastSettlement contract** (not the user). The contract:

1. Receives `received` tokens from the swap.
2. Reverts with `InsufficientOut(received, userAmtOut)` if `received < userAmtOut`.
3. Pays the user **exactly** `userAmtOut` (the slippage floor).
4. Retains `surplus = received − userAmtOut` in the contract.
5. Emits `IntentExecuted(user, inputToken, outputToken, inputAmt, userAmtOut, received, surplus)`.

The `tools/fastswap-miles/miles.go` cron then reads the `surplus` from the event and credits it to the user as miles (after deducting bid + gas).

Two consequences:

- **Higher slippage → fewer tokens received, more miles credited.** Because `userAmtOut` drops with slippage, the user receives less *as tokens* but the contract retains more *as surplus → miles*. This is the architectural reason the >5% warning copy is accurate ("You will earn more miles, but will likely receive less tokens").
- **No "auction efficiency" gap to discount.** There's no separate auction layer between `received` and `surplus` — the contract takes everything above the floor. So `surplus = received − userAmtOut` *is* the realized number, not an upper bound. Approximating `received ≈ barterPreGas` introduces only a small (~0.1–0.3%) execution-drift error.

---

## Why `gas_limit` and `gas_used` are different

- **Bid cost** is computed from `priorityFee × avgGasLimit` because the mev-commit bid is `priorityFee × txn.Gas()` — the protocol commits to paying for the gas *limit* of the transaction, not the gas it actually ends up using.
- **Gas cost** (permit path only) is computed from `baseFee × avgGasUsed` because the relayer is reimbursed for actual gas consumed, not the limit.

Mixing them up — e.g. using `avgGasLimit` for the gas-cost term — overstates the deduction and pushes miles negative on swaps that should earn.

## Path differences

- **ETH path** (user sells ETH → ERC-20): user pays L1 gas from their own wallet, so `gas_cost_eth = 0`. Only the bid cost is deducted.
- **Permit path** (user sells ERC-20): the relayer pays L1 gas and is reimbursed from MEV, so both `bid_cost_eth` and `gas_cost_eth` are deducted. Permit-path break-even is meaningfully higher than ETH path because of this.

## Why the 2.5× sweep multiplier exists

Non-ETH output goes through a batched fastswap with a sweep transaction. At current volume, batches are effectively size-1, so each user eats the whole sweep gas share. The realized `(bid + sweep_overhead) / bid` ratio swings widely day-to-day (p50 ranged 0.9–2.9 over the recent 10-day window the multiplier was tuned against); 2.5× covers the median of "bad" days while staying tolerable on cheap days.

This is a known bandaid. The TODO in `use-estimated-miles.ts` is to replace it with an Edge-Config-driven sweep overhead term computed from `surplus_eth − net_profit_eth − bid_cost` on recent finalized rows — same pattern as `miles_estimate_surplus_rate`.

---

## Worked example: 30 USDC → ETH (permit path) at 50% slippage

Reproduces the validated permit-path test case.

```
Inputs:
  uniswap_amount_out = 0.013033 ETH         (the displayed quote)
  slippage           = 50%
  barter_pre_gas     ≈ 0.01295 ETH          (~0.6% routing shortfall on permit path)
  priority_fee       = 0.069 gwei = 6.9e7 wei
  base_fee           = 2.72 gwei = 2.72e9 wei
  avg_gas_limit      = 539,564
  avg_gas_used       = 321,479
  isEthOutput        = true                  (sweep_multiplier = 1)
  isPermitPath       = true

Step 1 — userAmtOut from slippage:
  userAmtOut         = 0.013033 × (1 − 0.50) = 0.006517 ETH

Step 2 — Surplus (barter-surplus path):
  surplus_token      = max(0, 0.01295 − 0.006517) = 0.006433 ETH
  mev_pot_eth        = 0.006433 ETH         (output is ETH, no price conversion)

Step 3 — Bid cost:
  bid_cost           = 6.9e7 × 539,564 / 1e18 = 0.0000372 ETH

Step 4 — Gas cost (permit path):
  gas_cost           = 2.72e9 × 321,479 / 1e18 = 0.000874 ETH

Step 5 — Net MEV (ETH output → no sweep multiplier):
  net_mev_eth        = 0.006433 − 0.0000372 − 0.000874 = 0.005522 ETH

Step 6 — Miles:
  user_mev_eth       = 0.005522 × 0.9 = 0.004970 ETH
  miles              = floor(0.004970 × 100,000) = 497

Observed in dev: ~500 miles. Match within rounding.
```

### Linear scaling property

Because `surplus = barterPreGas − uniswapOut × (1 − slippage/100)`, surplus grows linearly in slippage:

```
Δsurplus_per_1%_slippage = uniswapOut × 0.01
Δmiles_per_1%_slippage   = uniswapOut × 0.01 × 0.9 × 100,000 / eth_price_factor
```

For the worked example: `Δmiles ≈ 11.7 per 1%` — observed slope was 11.7–11.8, exact match.

---

## Break-even (back-of-envelope)

The break-even slippage at which miles cross zero depends on path and gas:

```
breakeven_surplus_eth = total_deductions
                      = total_bid_cost + total_gas_cost

breakeven_slippage_pct = breakeven_surplus_eth / output_in_eth × 100
                       (when routing shortfall ≈ 0)
```

**ETH path** (no `gas_cost`, sweep applies for non-ETH output):
- bid_cost ≈ 0.000045 ETH × 2.5 = 0.000113 ETH
- For a 0.04 ETH output: breakeven slippage ≈ 0.28% — well below the 0.5% auto base, so most ETH-path swaps earn miles at default slippage.

**Permit path, ETH output** (gas_cost applies, sweep_multiplier = 1):
- bid + gas at typical 1.2 gwei base ≈ 0.000261 ETH
- For a 0.04 ETH output: breakeven slippage ≈ 0.65% — at the 1% permit auto base, miles are positive but small.
- For a 0.013 ETH output (~$30): breakeven slippage ≈ 2.0% at low gas, ~6.7% at high gas (2.7 gwei base). Below those, the trade is genuinely too small to clear gas.

**Permit path, non-ETH output** (sweep applies on top of gas):
- bid + gas times sweep ≈ 0.000875 ETH at 2.5×
- Roughly 5× the deduction of the ETH-output permit case; only meaningful for sizeable trades.

These thresholds move with priority/base fee, output size, and gas conditions. The estimator follows them automatically because the deduction terms are read live; users just see "Swap too small to earn miles" when the math doesn't clear.

---

## Implementation map

| Concern | File |
|---------|------|
| Estimation hook (formula, gas/surplus/bid fetches, recompute logic) | `src/hooks/use-estimated-miles.ts` |
| Surplus formula helper (pure, unit-tested) | `src/hooks/use-estimated-miles.ts` → `computeSurplusEth()` |
| Tests | `src/hooks/__tests__/use-estimated-miles.test.ts` |
| Barter proxy returning both `outputAmount` and `outputAmountPreGas` | `src/app/api/barter/route/route.ts` |
| Barter API client | `src/lib/barter-api.ts` |
| Validation hook (exposes `barterPreGasOutputAmount`) | `src/hooks/use-barter-validation.ts` |
| Form hook (pipes `barterPreGasOutputAmount` and `slippage` through) | `src/hooks/use-swap-form.ts` |
| Estimator call site | `src/components/swap/SwapForm.tsx` |
| Feature flag | `src/lib/feature-flags.ts` → `show_miles_estimate` |
| Pre-swap UI badge | `src/components/swap/RewardsBadge.tsx` |
| Confirmation-modal display | `src/components/modals/SwapConfirmationModal.tsx` |
| Edge Config endpoint (gas/surplus refresh) | `src/app/api/config/gas-estimate/route.ts` |
| Edge Config writer (cron) | `src/app/api/cron/update-edge-config/miles-estimate-gas/route.ts` |
| Bid estimate RPC | `mevcommit_estimateBidPricePerGas` via `RPC_ENDPOINT` |

### Recompute discipline

The memo dep list includes `barterPreGasOutputAmount`, `slippage`, `amountOut`, `toTokenDecimals`, prices, and path flags. Gas data (`priorityFee`, `baseFee`) and Edge Config values are read from refs inside the memo so the 12-second background poll doesn't trigger UI recomputations — only user-driven inputs and Barter validation settling do.

`lastMilesRef` holds the last successful value so transient null states (e.g. price loading between token switches) don't flash an empty Miles badge.

### What `barterPreGasOutputAmount` resolves to

The proxy at `src/app/api/barter/route/route.ts` returns two distinct fields from Barter's response:

- `outputAmount` — path-adjusted (post-gas on permit path, pre-gas on ETH path); used by `amountTooSmall` and the quote-guard. Represents what the user actually receives.
- `outputAmountPreGas` — Barter's raw routed output regardless of path; used by the miles estimator. Represents what the FastSettlement contract receives before paying the user, i.e. the right basis for `surplus = received − userAmtOut`.

Using `outputAmountPreGas` for surplus avoids double-counting gas: the gas line is already deducted explicitly via `gas_cost_eth`. Using `outputAmount` (post-gas) on permit path would subtract gas twice.

---

## Future work (not blocking)

- **Replace 2.5× sweep multiplier with a daily-refreshed Edge Config term.** Computed from `surplus_eth − net_profit_eth − bid_cost` on recent finalized non-ETH-output swaps, same cron pattern as `miles_estimate_surplus_rate`. Closes the swing between cheap and expensive days.
- **Optional 0.99 execution-drift discount on `surplusEth`.** Bakes in the small drift between Barter's quoted route and the contract's realized `received`, guaranteeing the displayed estimate is always met-or-beaten in steady state. One-line change; whether it's worth doing depends on how strict the under-promise property needs to be.
- **Surface "why is this 0?" tooltip on the badge.** When `enabled && net_mev_eth ≤ 0`, explain whether bumping slippage would help (it usually does) versus the trade being fundamentally too small. Pure UX improvement; doesn't touch the estimator.
- **Backfill `userAmtOut` and `barterPreGas` into the indexer.** Lets the cron compare displayed-vs-realized estimates by trade cohort over time. Useful for monitoring/regression detection rather than an active feature.
