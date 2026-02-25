# Transaction confirmation flow (TL;DR)

Two sources race to confirm a swap tx: **Fast RPC** (polled via `eth_getTransactionReceipt`) and **Wagmi** (on-chain receipt). The flow is robust to status flipping from success to failed before finality.

## Flow

- **RPC polling** (every 500ms): Single fetch per iteration. If receipt is **success** (0x1) → call `onPreConfirmed` once, show “pre-confirmed” UI, **keep polling**. If receipt is **reverted** (0x0) at any time → treat as final failure: stop polling, set `hasConfirmedRef` so Wagmi won’t override, call `onError` → UI shows error modal.
- **Wagmi**: When on-chain receipt arrives, if we already “confirmed” (including by RPC failure) we do nothing. Else: if reverted → `onError`; if success → `onConfirmed`, abort RPC polling.

So: pre-confirm is optimistic (0x1 from RPC); we keep re-checking until either Wagmi confirms or we see 0x0 and show error.

## Key pieces

- **Hook:** `useWaitForTxConfirmation` in `src/hooks/use-wait-for-tx-confirmation.ts` — runs the race, uses `fetchTransactionReceiptFromDb` (single request per loop), `preConfirmedFiredRef` so `onPreConfirmed` fires once per hash.
- **Swap UI:** `SwapToast` uses the hook only; `onPreConfirmed` → set status to `"pre-confirmed"`; `onError` → `setFailed` → `lastTxError` → SwapConfirmationModal shows the error.
- **Status:** RPC returns 0x1/0x0; `transaction-receipt-utils` normalizes to `"success"` / `"reverted"`. No raw 0x0/0x1 checks in UI.

## Outcome matrix

| RPC first      | Then        | Result                    |
|----------------|------------|---------------------------|
| 0x1 (success)  | keep polling | Pre-confirm shown        |
| 0x1 then 0x0   | —          | Error; Wagmi ignored     |
| 0x0            | —          | Error                     |
| Wagmi receipt  | —          | Success → `onConfirmed`; reverted → `onError` |
