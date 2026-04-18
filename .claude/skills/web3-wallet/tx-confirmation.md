# Transaction confirmation

## Files

- `src/hooks/use-wait-for-tx-confirmation.ts`
- `src/lib/transaction-receipt-utils.ts`
- `src/lib/fast-tx-status.ts` (Fast-specific status polling)
- `src/lib/transaction-errors.ts`
- `docs/tx-confirmation-flow.md` — the human-facing diagram; read first

## Flow

1. User signs tx; we get a hash.
2. Start waiting: `useWaitForTransactionReceipt` (wagmi) + `use-wait-for-tx-confirmation` wrapper.
3. Fast preconfirm (if applicable): `fast-tx-status.ts` polls the Fast endpoint for the commitment.
4. Final confirmation: receipt arrives; `transaction-receipt-utils.ts` extracts events.
5. Surface result: success toast (`swapToastStore`), error toast (normalized via `transaction-errors.ts`).

## Error surfacing

All errors go through `src/lib/transaction-errors.ts::normalizeTxError` (or equivalent). This:

- Maps provider-specific error codes to a canonical list
- Strips stack traces and internal URLs
- Produces a user-safe `{ title, description }` shape

Do not bypass this — raw viem / ethers errors contain RPC URLs and are not for users.

## Timeout handling

Preconfirm has a bounded wait. If we don't get a commitment within that window, fall back to normal finality. The hook handles this — don't reimplement.

## Do not

- Do not store the receipt in localStorage. It's big and rarely useful after the toast.
- Do not fire analytics with the full payload — extract only the fields you need (chain, method, outcome).
