---
name: contract-abis
description: Use when working with the ABIs in contracts-abi/, the typed bindings in src/lib/*-abi.ts and src/lib/fast-settlement-*.ts, or when tracing contract calls across the app. Use also when an ABI changes upstream and the app needs to sync.
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
  - `src/lib/fast-settlement-v2-1.ts`
  - `src/lib/fast-settlement-v3-abi.ts`
  - `src/lib/weth-abi.ts`
  - `src/lib/erc20-abi.ts`
- Address + ABI composition: `src/lib/contract-config.tsx`
- Server-side helpers: `src/lib/contract-server.ts`

## References

- ABI directory layout: [`abi-layout.md`](./abi-layout.md)
- Typing patterns (viem `const` ABIs): [`typing-patterns.md`](./typing-patterns.md)
- How contracts & abis relate: `agent_docs/contracts-and-abis.md`

## Workflow

### When an ABI changes

1. Drop the new JSON into `contracts-abi/abi/`.
2. Update the corresponding `*-abi.ts` in `src/lib/` (or the settlement file) — keep the `as const` assertion.
3. Use the `abi-tracer` subagent to find call sites: `Ask abi-tracer: "find every call site for function <name>"`.
4. Update callers.
5. Run `/verify`. The compiler will complain about arg/return shape mismatches — fix them, don't cast-away.

### When adding a new method call

1. Ensure the method exists in the `*-abi.ts` binding (if not, add it from the JSON).
2. Use wagmi's `useReadContract` / `useWriteContract` with the `abi` and `functionName` typed against the const ABI.
3. Add the address to `src/lib/contract-config.tsx` if it's a new contract.

## Guardrails

- **Never cast an ABI to `any`.** viem's type inference depends on the const shape.
- **Never duplicate an ABI inline** in a hook. Import from `src/lib/*-abi.ts`.
- **Do not assume v2.1 and v3 are interchangeable.** They have different method surfaces; the config resolves the target.
- **Addresses belong in config**, never in a component or hook.
- **Do not edit `contracts-abi/clients/`** — those are Go clients for other services; not the web app.

## Verification

- `/verify`
- `npm run build` — catches ABI typing regressions across the server/client boundary.
