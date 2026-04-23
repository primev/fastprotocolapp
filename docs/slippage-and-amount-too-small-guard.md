# Slippage model & the "Amount too small" guard

How slippage is modeled in the swap UI, why the "Amount too small" gate exists, and how user tolerance interacts with Barter's routing overhead.

---

## Overview

Two numbers run in parallel on every quote:

1. **Uniswap `amountOut`** — idealized on-chain price for the pair. This is what the UI shows in the "Receive" field. Fetched by `useQuote` (`src/hooks/use-swap-quote.ts`).
2. **Barter `/route` `outputAmount`** — what an actually-routed swap would deliver after L1 gas, routing hops, and fill mechanics. Fetched by `useBarterValidation` (`src/hooks/use-barter-validation.ts`).

The gap between them is the **shortfall**:

```
shortfallPct = (uniswapOut - barterOut) / uniswapOut * 100
```

Slippage tolerance is how much of that shortfall the user will absorb before the on-chain swap reverts at its `minAmountOut` check.

---

## Slippage modes

Managed by `useSwapSlippage` (`src/hooks/use-swap-slippage.ts`).

### Auto mode (default)

Picks the smallest tolerance that still lets the swap route reliably:

| Path | Base tolerance |
|------|----------------|
| ETH input (`ZERO_ADDRESS`, non-WETH output) | **0.5%** |
| Permit path (ERC-20 input) | **1%** |

The permit path carries slightly more routing overhead, so its floor is higher.

### Auto-bump for gas

When Barter's observed `shortfallPct` exceeds the auto base, auto mode visually bumps slippage to **2%** to cover routing cost.

```ts
const autoBumpedForGas = mode === "auto" && barterShortfallPct > autoBase
const autoSlippage     = autoBumpedForGas ? "2" : String(autoBase)
```

When this fires, the confirmation modal shows the note:

> Your slippage has been auto-adjusted to cover gas costs

Rendered in `SwapConfirmationModal.tsx:1030` off the `autoAdjustedForGas` prop (`= form.autoBumpedForGas`).

### Custom mode

User-entered value, range `[customMin, 50]`:
- `customMin` equals the path's auto base (0.5% or 1%) — the floor can't go below what auto would choose
- Hard cap **50%**, matching Uniswap's UI
- Above **5%**, an accordion amber banner opens in the settings popover with:
  > Slippage above 5% is unusual. You will earn more miles, but will likely receive less tokens.

---

## The "Amount too small" guard

### Purpose

The "Receive" number shown in the UI is the Uniswap quote. The on-chain swap actually goes through Barter's router, which carries real-world overhead — gas, hops, LP fills. For small trade sizes, that overhead is a significant fraction of the trade itself.

Without a pre-flight check, the user would sign a swap whose `minAmountOut` (derived from the Uniswap quote at their tight tolerance) is unreachable by the Barter-routed execution. The transaction would revert on-chain at the `minReturn` check — user pays gas for nothing and sees a confusing failure.

The guard catches this before the user signs, and replaces the swap button with `"Amount too small to swap"` (amber, disabled — priority 7 in the `ActionButton` cascade).

### How it's computed

Derived at the return site of `useBarterValidation`:

```ts
const amountTooSmall =
  settled &&                         // validation has completed
  shortfallPct > 0 &&                // we measured a real shortfall
  shortfallPct > maxSlippagePct      // user's current tolerance can't cover it
```

`maxSlippagePct` is piped in from `use-swap-form.ts` as `parseFloat(effectiveSlippage)` — it reflects **whatever the current slippage is right now**, auto or custom.

### Why `amountTooSmall` is derived, not stored

Earlier versions stored `amountTooSmall` in state and set it inside the API effect with a hardcoded `shortfall > 2.0` check. That caused two bugs:

1. **Stale gate after slippage bump** — if the user raised custom slippage to 5%, the gate didn't re-evaluate because there was no new Barter call to drive a new `setAmountTooSmall`.
2. **Flicker loop** — the auto-bump path created a new quote object reference (same `amountOut`, new `slippageLimit`), which bumped `quoteGeneration`, which re-ran validation, which briefly flipped `settled=false` ("Calculating…") before re-settling on the same shortfall.

Deriving `amountTooSmall` from `shortfallPct` + live `maxSlippagePct` makes the gate instantly responsive to slippage changes with zero extra API calls.

---

## How slippage unblocks the guard

`minAmountOut` — the on-chain floor that makes the swap revert if exceeded — is derived from tolerance:

```
minAmountOut = uniswapOut × (1 − slippage/100)
```

So tolerance directly controls how much routing overhead the user absorbs.

**Worked example — sell 0.001 ETH → USDC:**

| Slippage | `minAmountOut` | Barter delivers 2.85 USDC | Result |
|----------|----------------|---------------------------|--------|
| 0.5%     | 2.985 USDC     | 2.85 < 2.985              | Blocked |
| 2%       | 2.94 USDC      | 2.85 < 2.94               | Blocked |
| 5%       | 2.85 USDC      | 2.85 ≥ 2.85               | **Unblocks** |
| 50%      | 1.50 USDC      | 2.85 ≫ 1.50               | Unblocks (user eats the overhead) |

The guard isn't about Barter being broken — it's about the user's stated tolerance for quote-vs-execution divergence. Raising slippage widens that window so Barter's actual delivery falls inside it.

---

## Why auto caps at 2%

Auto mode silently bumps up to 2% but no further. Beyond that threshold, routing overhead starts to dominate the trade itself, and hiding that loss would be user-hostile. Above 2%, the UI blocks and forces a conscious opt-in via Custom mode. That's the role of the `>5%` warning copy — the user is choosing to earn more Miles (more room for builder-captured MEV) at the cost of a worse execution price.

---

## Where this lives in code

| Concern | File |
|--------|------|
| Slippage mode, auto/custom state, warning derivation | `src/hooks/use-swap-slippage.ts` |
| Uniswap quote + slippage-only `slippageLimit` recalc | `src/hooks/use-swap-quote.ts` |
| Barter `/route` call, shortfall calc, `amountTooSmall` derivation | `src/hooks/use-barter-validation.ts` |
| Call site: wires slippage → Barter → computedMinAmountOut | `src/hooks/use-swap-form.ts` |
| Settings popover (Auto/Custom toggle, >5% warning banner) | `src/components/swap/TransactionSettings.tsx` |
| Swap button state cascade (`Amount too small to swap`) | `src/components/swap/ActionButton.tsx` |
| Confirmation note ("auto-adjusted to cover gas costs") | `src/components/modals/SwapConfirmationModal.tsx:1030` |
| Post-failure retry recommender (caps at `SLIPPAGE_MAX`) | `src/lib/transaction-errors.ts` |

### Key constants

Defined in `use-swap-slippage.ts`:

| Constant | Value | Meaning |
|----------|-------|---------|
| `SLIPPAGE_MAX` | 50 | UI cap; matches Uniswap |
| `SLIPPAGE_STEP` | 0.1 | Rounding granularity on blur |
| `SLIPPAGE_WARN_THRESHOLD` | 5 | Above this, `slippageWarning = "high"` |
| `AUTO_BASE_ETH` | 0.5 | Auto floor for ETH input |
| `AUTO_BASE_PERMIT` | 1 | Auto floor for ERC-20 input |

---

## Stability invariants to preserve

Changes to any of these files should maintain:

1. **Slippage-only quote updates must NOT trigger Barter re-validation.** `quoteGeneration` in `use-swap-form.ts` is gated on `amountOut`/`amountIn` reference change — **not** on the quote object reference. A slippage change produces a new quote object (via the slippage-only effect in `use-swap-quote.ts`) with the same `amountOut`, and that must not bump `quoteGeneration`.
2. **`amountTooSmall` must remain derived, not stored.** Storing it in state re-introduces the stale-after-bump bug.
3. **Custom floor must not go below auto base.** The `useEffect` in `useSwapSlippage` clamps up when `customMin` rises (ETH → ERC-20 path switch). This effect must **not** depend on `customSlippage` itself — doing so re-runs it on every keystroke and rewrites partial input like `"0."` or `""` before the user can finish typing.
