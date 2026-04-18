# Permit2

Uniswap's signature-based approval standard. One signed permit authorizes many future transfers to a spender until the deadline expires or the nonce is invalidated.

## Why this matters

- Cheaper: one permit signature replaces per-swap `approve` transactions.
- Safer: deadlines limit exposure if a signature leaks.
- Correctness-critical: a wrong nonce or expired deadline silently fails the swap at settlement.

## Files

- `src/lib/permit2-utils.ts` — signature construction, typed-data helpers
- `src/hooks/use-permit2-allowance.ts` — checks whether a permit is needed
- `src/hooks/use-permit2-nonce.ts` — fetches the next nonce

## Invariants

1. **Deadline ≠ optional.** Always set a bounded deadline (typically minutes, not hours). The guard logic compares against chain time.
2. **Nonce freshness.** Always fetch nonce as close to signing as possible. A cached nonce causes silent failures.
3. **Spender address** must match the settlement contract the app is targeting (see `src/lib/contract-config.tsx`). Cross-contract permits are not interchangeable.
4. **Signature is not a transaction.** Never log, transmit, or persist it beyond the swap-execution path. Drop it from state as soon as the tx is submitted.
5. **Amount vs max-amount.** The app generally signs the exact amount for the current swap. Do not introduce "unlimited" permits without an explicit product decision.

## When permit2 changes

If `src/lib/contract-config.tsx` or the Permit2 address changes:

1. Update `permit2-utils.ts` typed data.
2. Update allowance hook if the interface diverged.
3. Run all swap tests.
4. Manually test a signed swap on testnet before merging.

## Anti-patterns

- Do not bypass `use-permit2-allowance` — the "if I just sign every time" pattern leaks signatures and wastes UX.
- Do not hardcode `MaxUint256` deadlines.
- Do not share nonces across different spenders.
