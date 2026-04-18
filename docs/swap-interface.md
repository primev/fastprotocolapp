# Swap interface: user-facing states & messages

> **Audience: humans.** For agents, the authoritative swap-engine guide lives in
> [`.claude/skills/defi-swap/`](../.claude/skills/defi-swap/). This file is a
> reference for product/QA on every user-visible string in the swap UI; don't
> treat it as load-bearing for code behavior.

Reference for every state, message, and visual cue a user may encounter in the swap UI.

---

## Swap button states

The swap button (`ActionButton.tsx`) is a priority cascade — the first matching condition wins.

| Priority | Condition | Button text | Style |
|----------|-----------|-------------|-------|
| 1 | Wallet not connected | **Connect Wallet** | Gradient, clickable — opens RainbowKit modal |
| 2 | Not whitelisted | **Come back at launch** | Gradient at 50% opacity, disabled |
| 3 | No destination token selected | **Select a token** | Gray, disabled |
| 4 | No amount entered (empty or "0") | **Enter an amount** | Gray, disabled |
| 5 | Balance < entered amount | **Insufficient balance** | Gray, disabled |
| 6 | No Uniswap pool/route exists | **This trade cannot be completed right now** | Gray, disabled |
| 7 | Barter output shortfall > 2% | **Amount too small to swap** | Amber warning, disabled |
| 8 | Quote loading or Barter validating | **Calculating...** | Gray, disabled, spinner (1.5s min display to prevent flicker) |
| 9 | Permit2 nonce loading | **Initializing...** | Gray, disabled, spinner |
| 10 | All checks pass, wrap pair | **Wrap** | Gradient, clickable |
| 11 | All checks pass, unwrap pair | **Unwrap** | Gradient, clickable |
| 12 | All checks pass, normal swap | **Swap** | Gradient, clickable |

Connection-settling and whitelist-loading both show a skeleton loader instead of any button text.

---

## "This trade cannot be completed right now"

Displayed when `hasNoLiquidity` is true. A "Why am I seeing this?" link appears below the button, opening a modal that explains the possible causes.

Triggers:

1. **All fee tiers fail** — the Uniswap V3 QuoterV2 `simulateContract` reverts for all three fee tiers (500, 3000, 10000). This means no pool exists or all pools have zero liquidity. `noLiquidity` is set to `true` in `use-swap-quote.ts`.
2. **RPC client error** — the RPC call itself throws (network error, DNS failure, etc.) for every configured endpoint. Each failure is caught and the next client is tried; if all fail, `bestQuote` stays null and `noLiquidity` is set.
3. **Per-fee-tier timeout** — each fee tier call has a 5-second timeout. If all three time out, all results are failures, returning null from `getBestQuoteFromFeeTiers`.
4. **Quote error contains "No liquidity found"** — the `hasNoLiquidity` memo in `use-swap-form.ts` also checks `quoteError.message` for this string.

Escape hatch: if the user just flipped the token pair (manual inversion) and a swapped quote exists, `hasNoLiquidity` is forced to `false` so the UI doesn't flash the error during refetch.

Common real-world causes:
- No Uniswap V3 pool exists for the selected pair on this chain.
- A pool exists but has zero liquidity at the current tick.
- The token addresses are valid but no multi-hop route can be found.
- All RPC endpoints are temporarily unreachable or returning errors.
- Quote requests timed out before a response was received.

---

## "Amount too small to swap"

Displayed when Barter validation (`use-barter-validation.ts`) determines the trade is not viable. The hook compares the Barter router's quoted output against the Uniswap quote — if the shortfall exceeds 2%, the amount is flagged as too small. This typically happens with very small trade sizes where routing overhead eats into the output.

Styled in amber (warning) rather than gray to distinguish it from hard failures.

---

## Quote lifecycle

| Event | What happens |
|-------|-------------|
| User types amount | 500ms debounce, then quote fetch starts |
| Quote returned | Exchange rate, price impact, gas estimate, and output amount all update |
| 15s timer expires | Auto-refetch (timer visible as blue countdown badge next to rate) |
| Page hidden or user idle | Timer pauses — no unnecessary RPC calls |
| Manual token flip | Swapped quote shown immediately; fresh quote fetched in background; yellow pulsing badge replaces blue |
| Wrap/unwrap pair | No quote fetched — 1:1 ratio used, no timer shown |

Quote timeout is 15 seconds per request. If primary RPC fails, fallback endpoints are tried. Stale responses are discarded via request-ID tracking.

---

## Exchange rate & price impact

Shown below the swap cards when a valid quote exists.

- **Rate**: "1 {FROM} = {rate} {TO}" — uses NumberFlow for animated transitions on refetch. Stablecoin pairs show 2+ decimals; others show 0-3.
- **Price impact**: "(Impact: {n}%)" in gray. Only shown for real swaps (not wrap/unwrap). During manual inversion, shows "..." until the fresh quote arrives.

---

## Miles estimation

Gated behind the `show_miles_estimate` feature flag.

- **Has miles**: "~{n} miles" in blue (#3898FF) with a pulsing dot animation.
- **Zero miles**: "No miles" in gray.
- Hidden entirely for wrap/unwrap operations and when the flag is off.

Recalculates on every quote fetch based on output USD value, slippage, token type, and priority fee percentile (p55).

---

## Transaction settings popover

Opened via the gear icon in the swap header.

- **Max slippage**: Decimal input with "%" suffix. Capped at 2%. Default shown as the current value. When a non-default value is active, the gear button shows the percentage alongside the icon.
- **Swap deadline**: Numeric input in minutes. Default 30. Range 5-1440. Transaction reverts if not confirmed within this window.

---

## Sell & buy cards

| Element | Sell card | Buy card |
|---------|-----------|----------|
| Label | "SELL" | "BUY" |
| Balance | "Balance: {n}" when token selected | Same |
| Token button (none selected) | "Select token" — blue gradient | Same |
| Token button (selected) | Token icon + symbol, gray background | Same |
| USD value | "{amount} {symbol} = ${usd}" | "${usd}" |
| Error styling | Red border when insufficient balance | — |

Token icon fallback: if the image fails to load, the first letter of the symbol is shown on a gray circle.

---

## Confirmation modal

Opened when the user clicks Swap/Wrap/Unwrap.

**Review section**: Shows send amount, receive amount, exchange rate, and price impact.

**Details accordion**:
- Minimum received (exactIn) or Maximum sold (exactOut) — in green.
- Estimated gas fee in ETH + USD.
- Exchange rate at full precision.
- Swap deadline in minutes.

**Approval flow** (ERC-20 tokens that need Permit2 approval):
1. "Approve {symbol}" button shown.
2. User confirms in wallet → "Approving..." with spinner.
3. Approval confirmed → swap auto-executes.

**Signing & submission**: Button shows "Confirming..." with spinner while waiting for wallet signature and relayer submission.

---

## Toast notifications

After submission, a toast tracks the transaction through its lifecycle. See `docs/tx-confirmation-flow.md` for the RPC polling / Wagmi race details.

| State | Status text | Visual |
|-------|------------|--------|
| Pending | "Swapping..." | Spinning loader with pulsing ring; shows "{amountIn} {FROM} -> {amountOut} {TO}" |
| Pre-confirmed | "Tokens Pre-confirmed" | Blue text, Fast Protocol icon animates in |
| Confirmed | "Tokens Available" | White text, clickable to open block explorer |
| Failed (slippage) | "Slippage too low" | Amber; shows "Minimum required: {n}%" and a "Retry {n}%" button that auto-adjusts slippage |
| Failed (generic) | "Swap Failed" | Red; click to open full error details in modal |

The toast starts collapsed as a minimal "Pending" bubble. Click to expand. Click outside an expanded confirmed/failed toast to dismiss.

---

## Wrap & unwrap

Detected automatically when the token pair is ETH <-> WETH.

- Button says **Wrap** or **Unwrap** instead of Swap.
- No quote is fetched — amounts are always 1:1.
- No slippage protection, price impact, or miles display.
- Quote refresh timer is hidden.
- Gas estimate uses the wrap/unwrap-specific calculation.

---

## Error conditions from the quote hook

| Error | Cause |
|-------|-------|
| "Cannot swap a token for itself..." | `tokenIn` address equals `tokenOut` address |
| "Amount is too large..." | Input amount exceeds 1e21 |
| "Token address not found..." | Token metadata missing an address |
| No liquidity (silent) | All fee tiers revert across all RPC endpoints — triggers the "cannot be completed" button |
