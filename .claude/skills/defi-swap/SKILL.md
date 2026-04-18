---
name: defi-swap
description: Use when editing the swap flow — quoting, slippage, permit2, WETH wrap/unwrap, ETH-path tx construction, Fast RPC quote polling, or anything under src/components/swap or src/hooks/use-swap-*. Also for tx-confirmation UX and preconfirm handling.
---

# DeFi swap

The swap engine is the critical path of this app. Changes here can move user funds — be exact.

## When to use

- Editing any file in `src/components/swap/**`
- Editing any hook matching `src/hooks/use-swap-*.ts` or `use-permit2-*`, `use-weth-wrap-unwrap`
- Editing `src/lib/swap-logic/`, `swap-constants.ts`, `swap-events.ts`, `swap-server.ts`, `quote-guard.ts`
- Changing slippage behavior, permit2 deadlines, or WETH conversions

## Key files

- Engine: `src/lib/swap-logic/token-list.ts`, `src/lib/swap-server.ts`, `src/lib/swap-constants.ts`, `src/lib/swap-events.ts`
- Hooks: `src/hooks/use-swap-form.ts`, `use-swap-quote.ts`, `use-swap-intent.ts`, `use-swap-slippage.ts`, `use-swap-confirmation.ts`
- Guards: `src/lib/quote-guard.ts`, `src/hooks/use-quote-guard-config.ts`
- UI: `src/components/swap/SwapInterface.tsx`, `SwapForm.tsx`, `SellCard.tsx`, `BuyCard.tsx`, `ActionButton.tsx`, `TransactionSettings.tsx`
- Tx construction: `src/lib/eth-path-tx.ts`, `src/hooks/use-eth-path-gas-estimate.ts`
- State: `src/stores/swapToastStore.ts`, `src/components/swap/SwapToast*.tsx`
- Types: `src/types/swap.ts`

## References

- Engine mechanics: [`swap-engine.md`](./swap-engine.md)
- Permit2: [`permit2.md`](./permit2.md)
- Quote polling: [`quote-polling.md`](./quote-polling.md)
- Human deep-dive: `docs/swap-interface.md`
- Tx confirmation flow: `docs/tx-confirmation-flow.md`
- Quote freshness: `docs/quote-polling-idle-detection.md`

## Workflow

1. Read `docs/swap-interface.md` first if you're unfamiliar with the flow.
2. Identify which stage of the flow the change sits in: form input → quote → intent → permit2 approval → confirmation → preconfirm → settlement.
3. Trace existing hook composition before adding a new hook — the flow is chained intentionally.
4. Mirror existing patterns for error handling (see `src/lib/transaction-errors.ts`).
5. Run `npm run test:run` — swap logic has tests in `src/lib/__tests__/`.
6. Verify in dev: run through the swap flow manually, watch the swap-toast events.

## Guardrails

- **Never loosen slippage bounds** without explicit user request. Default constraints are in `src/lib/swap-constants.ts`.
- **Respect permit2 deadlines.** See [permit2.md](./permit2.md).
- **Do not skip `quote-guard`** for "simplicity." Stale quotes = user loss.
- **Do not log signed payloads** anywhere — analytics, console, errors.
- **Preserve existing error-normalization** in `src/lib/transaction-errors.ts`. Surfacing raw provider errors to users is a regression.
- **Test ETH-path and ERC20-path separately.** `use-eth-path-gas-estimate` and the regular path diverge.

## Verification

- `/verify` for types + lint + tests.
- Manual: run `npm run dev`, perform a real swap on a testnet, watch the toast sequence.
- Edge cases to touch: slippage at limit, permit2 expiring mid-flow, WETH → ETH unwrap, ETH → WETH wrap, network switch mid-quote.
