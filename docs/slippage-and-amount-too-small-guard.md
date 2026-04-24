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

When Barter's observed `shortfallPct` exceeds the auto base, auto mode bumps
the visible slippage to **cover the shortfall plus a small buffer** so the
amount-too-small gate actually clears.

```ts
const autoBumpedForGas = mode === "auto" && barterShortfallPct > autoBase
const autoSlippage     = autoBumpedForGas
  ? formatSlippage(computeAutoBumpValue(barterShortfallPct))
  : formatSlippage(autoBase)

// computeAutoBumpValue:
//   roundedUp = ceil(shortfall / SLIPPAGE_STEP) * SLIPPAGE_STEP   // round up to 0.1%
//   return   = min(SLIPPAGE_MAX, roundedUp + AUTO_BUMP_BUFFER_PCT) // + 0.5%, capped at 50%
```

**Why the buffer.** Barter's routed output drifts slightly between quotes as
pool state and gas move. Without headroom, a 15-second requote reporting
shortfall 0.1–0.3% higher than the one we just bumped to would immediately
re-block the swap with "Amount too small". `AUTO_BUMP_BUFFER_PCT = 0.5` is the
smallest value that absorbs realistic requote jitter.

**Why the auto mode used to hardcode 2%.** An earlier iteration set
`autoSlippage = "2"` on the assumption that 2% was always enough to route.
For small trade sizes that assumption breaks — routing overhead can easily
reach 5–10% of a tiny trade — and the user ended up with a bumped slippage
that *still* didn't clear the gate, stranding them on "Amount too small" with
no way to proceed short of switching to custom. Using the actual observed
shortfall as the input makes auto reliably unblock the gate for any trade
size within the UI cap.

**Worked examples:**

| Observed shortfall | Rounded up (0.1%) | + buffer | `autoSlippage` |
|--------------------|-------------------|----------|----------------|
| 0.3%               | —                 | —        | `autoBase` (no bump; under threshold) |
| 0.6%               | 0.6%              | 1.1%     | `1.1` |
| 1.4%               | 1.4%              | 1.9%     | `1.9` |
| 2.7%               | 2.7%              | 3.2%     | `3.2` |
| 7.1%               | 7.1%              | 7.6%     | `7.6` (crosses `SLIPPAGE_WARN_THRESHOLD`, warning fires) |
| 49.9%              | 49.9%             | 50%      | `50` (clamped at `SLIPPAGE_MAX`) |

When `autoBumpedForGas` is true, the confirmation modal shows:

> Your slippage has been auto-adjusted to cover gas costs

Rendered in `SwapConfirmationModal.tsx:1030` off the `autoAdjustedForGas` prop
(`= form.autoBumpedForGas`).

### Custom mode

User-entered value, range `[customMin, 50]`:
- `customMin` equals the path's auto base (0.5% or 1%) — the floor can't go below what auto would choose
- Hard cap **50%**, matching Uniswap's UI

### The >5% warning (mode-agnostic)

Whenever the **effective** slippage (whatever `settings.slippage` resolves to
— auto-bumped or custom) crosses `SLIPPAGE_WARN_THRESHOLD = 5`, the amber
accordion banner in the settings popover opens:

> Slippage above 5% is unusual. You will earn more miles, but will likely receive less tokens.

The warning derivation lives in `useSwapSlippage` and reads `slippage`, not
`customSlippage` — so an auto-bump into warning territory is still surfaced
to the user rather than silent. Earlier versions gated the warning on
`mode === "custom"`, which hid unusually-high auto-bumps.

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

## Auto's upper bound

Auto scales up to `SLIPPAGE_MAX` (50%) if the observed shortfall demands it —
there is no artificial ceiling below that. The expectation is that shortfalls
large enough to push auto above `SLIPPAGE_WARN_THRESHOLD` only occur on
genuinely marginal trade sizes, and for those users an executable path with a
visible warning is more useful than a hard block.

Two backstops keep auto-bump honest:

1. The `"Your slippage has been auto-adjusted to cover gas costs"` note on the
   confirmation screen (fires for any `autoBumpedForGas = true`).
2. The mode-agnostic `>5%` warning banner in the settings popover (fires
   whenever the numeric slippage crosses the threshold).

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
