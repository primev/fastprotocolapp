---
name: contract-abis
description: Use when working with the ABIs in contracts-abi/, the typed bindings in src/lib/tokens/*-abi.ts (WETH, ERC20), Genesis SBT bindings in src/lib/contract-config.tsx, or when tracing contract calls across the app. Use also when an ABI changes upstream and the app needs to sync. Note — the FastSettlement contract is NOT called directly from the web app; swaps go through the FastSwap HTTP API under src/app/api/fastswap.
---

# Contract ABIs

How the app consumes Fast Protocol contract ABIs and keeps typed bindings in sync.

## When to use

- An ABI changed in `contracts-abi/abi/`
- A new contract method needs to be called from the app
- Tracing "where do we call function X" across hooks and components
- Updating `src/lib/contract-config.tsx`

## Key files

- ABI source: `contracts-abi/abi/` (JSON)
- Typed bindings (hand-maintained, const-asserted):
  - `src/lib/tokens/weth-abi.ts` — minimal WETH9 (deposit/withdraw/balanceOf)
  - `src/lib/tokens/erc20-abi.ts` — generic ERC-20 interface
- Address + ABI composition: `src/lib/contract-config.tsx` (Genesis SBT)
- Server-side helpers: `src/lib/contract-server.ts`
- FastSettlement struct types (for EIP-712 payloads, not direct calls):
  `src/types/swap.ts`

> **FastSettlement is HTTP-only from the web app.** Swaps post signed
> `SwapIntent` payloads to the FastSwap API (`src/app/api/fastswap/route.ts`),
> which relays to the backend executor. The standalone `fast-settlement-*.ts`
> modules under `src/lib/` were removed in the agentic-repo-design refactor
> because nothing imported them. If you need a direct contract call path
> later, use viem's `getContract` against the address from
> `src/lib/config/network.ts` and the ABI JSON under `contracts-abi/abi/`.

## References

- ABI directory layout: [`abi-layout.md`](./abi-layout.md)
- Typing patterns (viem `const` ABIs): [`typing-patterns.md`](./typing-patterns.md)
- How contracts & abis relate: `agent_docs/contracts-and-abis.md`

## Workflow

### When an ABI changes

1. Drop the new JSON into `contracts-abi/abi/`.
2. Update the corresponding `*-abi.ts` under `src/lib/tokens/` (or
   `src/lib/contract-config.tsx` for Genesis SBT) — keep the `as const`
   assertion so viem can infer types.
3. Use the `abi-tracer` subagent to find call sites:
   `Ask abi-tracer: "find every call site for function <name>"`.
4. Update callers.
5. Run `/verify`. The compiler will complain about arg/return shape
   mismatches — fix them, don't cast away.

### When adding a new method call

1. Ensure the method exists in the `*-abi.ts` binding (if not, add it from
   the JSON).
2. Use wagmi's `useReadContract` / `useWriteContract` with the `abi` and
   `functionName` typed against the const ABI.
3. Add the address to `src/lib/contract-config.tsx` if it's a new contract.

## Guardrails

- **Never cast an ABI to `any`.** viem's type inference depends on the const shape.
- **Never duplicate an ABI inline** in a hook. Import from
  `src/lib/tokens/*-abi.ts` or `src/lib/contract-config.tsx`.
- **Addresses belong in config**, never in a component or hook.
- **Do not edit `contracts-abi/clients/`** — those are Go clients for other
  services; not the web app.

## Verification

- `/verify`
- `npm run build` — catches ABI typing regressions across the server/client
  boundary. The `post-edit-build.sh` hook runs this automatically when you
  edit server routes that consume ABIs.
