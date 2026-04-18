# Contracts and ABIs

Two directories, two roles. Don't confuse them.

## `contracts/` — the Solidity source of truth

Foundry project. Contains:

- `src/` — Solidity contracts
- `test/` — Foundry tests
- `script/` — deploy / helper scripts
- `lib/` — git-submodule deps (OpenZeppelin, etc.)

**Rule**: treat this as read-only from the app's perspective. Any edit here changes on-chain behavior and must go through the contracts team. Do not touch during app-only work.

## `contracts-abi/` — the consumer-facing ABI layer

```
contracts-abi/
├── abi/        # JSON ABI files — authoritative for the web app
├── clients/    # Go clients (used by other services, not the Next app)
├── go.mod / go.sum / script.sh
```

The web app consumes the JSON in `contracts-abi/abi/` — usually via typed bindings assembled in `src/lib/contract-config.tsx` and specialized files like:

- `src/lib/fast-settlement-v2-1.ts`
- `src/lib/fast-settlement-v3-abi.ts`
- `src/lib/weth-abi.ts`
- `src/lib/erc20-abi.ts`

## When an ABI changes

1. New ABI JSON lands under `contracts-abi/abi/`.
2. Regenerate or manually update the typed binding in `src/lib/*-abi.ts` or the relevant `*-settlement-*.ts`.
3. Search call sites with the `abi-tracer` subagent: `.claude/agents/abi-tracer.md`.
4. Update all call sites, run `/verify`.

## When an ABI does **not** change

Don't touch the files in `contracts-abi/` or the `*-abi.ts` wrappers. These are load-bearing across hooks and server helpers.

## Address resolution

Contract addresses per chain live in `src/lib/contract-config.tsx` and `src/lib/network-config.ts`. Use these — never hardcode addresses in components or hooks.

## See also

- `.claude/skills/contract-abis/SKILL.md`
- `.claude/agents/abi-tracer.md`
