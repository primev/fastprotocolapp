---
name: web3-wallet
description: Use when integrating or modifying wallet connect / sign / send flows using wagmi, viem, RainbowKit, or ethers v6. Covers balance reads, chain switching, tx signing, tx waiting, and gas estimation. Distinct from defi-swap (which is the swap-flow orchestration); this skill is the wallet-layer primitives.
---

# Web3 wallet

Primitives for reading wallet state and submitting transactions.

## When to use

- Adding or editing `src/hooks/use-wallet-*`, `use-rpc-*`, `use-network-installation`, `use-add-fast-to-metamask`, `use-smart-account-detection`
- Adding a new on-chain read / write in a hook or component
- Changing `src/lib/wagmi.ts` or `src/lib/wallet-provider.ts`
- Touching `src/components/providers.tsx`

## Key files

- `src/lib/wagmi.ts` — chains, transports, connectors
- `src/lib/wallet-provider.ts` — low-level provider helpers
- `src/lib/network-config.ts` — per-chain defaults
- `src/components/providers.tsx` — mounted providers
- Hooks: `use-wallet-connection.ts`, `use-wallet-info.ts`, `use-wallet-provider.ts`, `use-rpc-setup.ts`, `use-rpc-test.ts`, `use-read-only-contract-call.ts`, `use-smart-account-detection.ts`

## References

- wagmi patterns: [`wagmi-patterns.md`](./wagmi-patterns.md)
- Tx confirmation flow: [`tx-confirmation.md`](./tx-confirmation.md) (also see `docs/tx-confirmation-flow.md`)

## Workflow

1. Determine if the call is read-only or state-changing.
   - Read-only → `useReadContract` (wagmi) or `use-read-only-contract-call`.
   - State-changing → wagmi's `useWriteContract` + a confirmation hook.
2. For balances, prefer `useBalance` (wagmi) over raw viem calls.
3. For chain switching, use `useSwitchChain` from wagmi — do not prompt the user via `window.ethereum` directly.
4. For waiting on a tx, use `use-wait-for-tx-confirmation.ts`.
5. For normalized error surfaces, pass errors through `src/lib/transaction-errors.ts`.

## Guardrails

- Never touch `window.ethereum` directly. Use the wagmi abstractions.
- Never hardcode chain IDs — use values from `src/lib/network-config.ts`.
- Never persist a signed transaction hash in localStorage / analytics before it confirms — if the user cancels, you'll have stale state.
- Never block the UI on a chain read without a loading state — RPC latency is real.
- Do not assume `account.address` is defined in a server component; wagmi is client-only.

## Verification

- `/verify`
- Manual: connect wallet, switch chain, run a read and a write. Watch the console for unhandled errors.
