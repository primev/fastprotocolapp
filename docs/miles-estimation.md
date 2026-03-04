# Fast Miles Estimation

Estimated miles are calculated pre-swap to show users how many Fast Miles they will earn. The estimate is displayed in the swap form (RewardsBadge) and the confirmation modal.

Gated by `FEATURE_FLAGS.show_miles_estimate`.

## Formula

```
slippage_amount_eth = (slippage% / 100) × output_amount_in_eth
bid_cost_eth        = eth_maxPriorityFeePerGas × 450,000 / 1e18
gas_cost_eth        = baseFeePerGas × 450,000 / 1e18       (permit path only)
net_mev_eth         = slippage_amount_eth - bid_cost_eth - gas_cost_eth
estimated_miles     = floor(net_mev_eth × 0.9 × 100,000)
```

If `estimated_miles < 1`, the UI shows "Swap too small to earn miles".

### Variables

| Variable | Description |
|---|---|
| `slippage%` | User-configured max slippage (e.g. 0.5%) |
| `output_amount_in_eth` | Expected output converted to ETH. If output token is ETH/WETH, used directly. Otherwise: `amountOut × toTokenPriceUSD / ethPriceUSD` |
| `eth_maxPriorityFeePerGas` | Network priority fee from RPC (polled every ~12s). Used to estimate the mev-commit bid the protocol pays to block builders |
| `baseFeePerGas` | Current L1 base fee from the latest block |
| `450,000` | Average gas limit for FastSwap transactions |
| `0.9` | User receives 90% of captured MEV |
| `100,000` | Miles per ETH (1 mile = 0.00001 ETH) |

### Path differences

- **ETH path** (user sends ETH): User pays L1 gas directly, so `gas_cost_eth = 0`. Only the bid cost is deducted.
- **Permit path** (user sends ERC-20): Relayer pays L1 gas, so both bid cost and gas cost are deducted from the MEV.

## Example: 10 USDC → ETH (permit path)

Swap 10 USDC for 0.004696 ETH at 0.5% slippage.

```
Inputs:
  output           = 0.004696 ETH
  slippage         = 0.5%
  priorityFee      = ~0.1 gwei
  baseFee          = ~1.16 gwei
  isPermitPath     = true

Step 1 — Slippage amount:
  slippage_amount  = (0.5 / 100) × 0.004696
                   = 0.00002348 ETH

Step 2 — Bid cost (mev-commit bid to builder):
  bid_cost         = 0.1 gwei × 450,000 / 1e18
                   = 0.1e9 × 450,000 / 1e18
                   = 0.00000045 ETH

Step 3 — Gas cost (relayer pays on permit path):
  gas_cost         = 1.16 gwei × 450,000 / 1e18
                   = 1.16e9 × 450,000 / 1e18
                   = 0.00052274 ETH

Step 4 — Net MEV:
  net_mev          = 0.00002348 - 0.00000045 - 0.00052274
                   = -0.00049971 ETH

Step 5 — Estimated miles:
  net_mev is negative → estimated_miles = 0
  UI shows: "Swap too small to earn miles"
```

In this example, the L1 gas cost (0.00052 ETH / ~$1.05) far exceeds the slippage amount (0.000023 ETH / ~$0.047). The swap is too small for the protocol to profit from MEV redistribution.

### Break-even calculation (permit path)

To earn at least 1 mile, `net_mev_eth` must be >= `1 / (0.9 × 100,000)` = 0.0000111 ETH.

In practice, the minimum output in ETH for positive miles is approximately:

```
min_output_eth ≈ (gas_cost + bid_cost) / (slippage% / 100)
               ≈ 0.000523 / 0.005
               ≈ 0.1046 ETH (~$210 at $2,000/ETH)
```

For ETH path swaps (no gas deduction), the threshold is much lower:

```
min_output_eth ≈ bid_cost / (slippage% / 100)
               ≈ 0.00000045 / 0.005
               ≈ 0.00009 ETH (~$0.18)
```

## Implementation

- **Hook:** `src/hooks/use-estimated-miles.ts`
- **Feature flag:** `src/lib/feature-flags.ts` → `show_miles_estimate`
- **UI (pre-swap):** `src/components/swap/RewardsBadge.tsx`
- **UI (confirmation):** `src/components/modals/SwapConfirmationModal.tsx`
