# Swap engine

## Flow (high level)

1. **User input** — `SwapForm.tsx` binds amount, token pair, slippage. Validation via `use-swap-form`.
2. **Quote** — `use-swap-quote.ts` fetches from the quote source (Fast RPC / Barter depending on config). Polls — see [quote-polling.md](./quote-polling.md).
3. **Quote guard** — `quote-guard.ts` checks staleness / price bounds; disables action if stale.
4. **Intent** — `use-swap-intent.ts` produces the signable payload.
5. **Permit2 approval (if needed)** — `use-permit2-allowance.ts` checks; `use-permit2-nonce.ts` fetches nonce; user signs (NOT a tx).
6. **Tx build** — `eth-path-tx.ts` (for ETH path) or the standard path inside the engine.
7. **User signs tx** — wagmi's write hook.
8. **Wait for preconfirm** — Fast Protocol's sub-second commitment.
9. **Wait for final confirmation** — `use-wait-for-tx-confirmation.ts`.
10. **Toast + telemetry** — `swap-events.ts` logs events; `swapToastStore` drives the toast UI.

## Source files in order of execution

```
src/hooks/use-swap-form.ts
src/hooks/use-swap-quote.ts
src/lib/quote-guard.ts
src/hooks/use-swap-intent.ts
src/hooks/use-permit2-allowance.ts
src/hooks/use-permit2-nonce.ts
src/lib/permit2-utils.ts
src/lib/eth-path-tx.ts
src/hooks/use-eth-path-gas-estimate.ts
src/hooks/use-swap-confirmation.ts
src/hooks/use-wait-for-tx-confirmation.ts
src/lib/swap-events.ts
src/stores/swapToastStore.ts
```

## State machines

Most of the state is implicit in the TanStack Query cache (for quotes and balances) + hook composition (for the intent → approval → send pipeline). Do not introduce a new state-management library. If you need to add state, extend the existing store or add a narrow Zustand slice following `swapToastStore.ts`.

## ETH path vs ERC20 path

ETH-input or ETH-output swaps require extra handling (no approval needed for native ETH; unwrap/wrap on either leg). `eth-path-tx.ts` isolates this. Keep the branch explicit — don't try to unify the paths.

## Touch points for common changes

| Change | Files |
|---|---|
| Slippage default | `src/lib/swap-constants.ts` |
| Quote poll interval | `src/hooks/use-swap-quote.ts`, `docs/quote-polling-idle-detection.md` |
| Toast copy | `src/components/swap/SwapToast.tsx` |
| Preconfirm sound | `src/lib/preconfirm-sound.ts`, `src/components/swap/PreconfirmCelebration.tsx` |
| New error code surfaced | `src/lib/transaction-errors.ts` |
