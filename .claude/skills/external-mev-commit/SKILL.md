---
name: external-mev-commit
description: Load when a question or edit depends on the mev-commit protocol source of truth — FastSwap HTTP handler shape, preconf RPC behavior, miles/Fuul indexer logic, canonical FastSettlementV3 ABI, or Solidity source needed to debug a revert. The upstream repo is vendored read-only under .external/mev-commit/ by the /prime and /sync-externals commands. Never write to .external/.
---

# External: mev-commit

The upstream protocol repo (`primev/mev-commit`). Vendored read-only
under `.external/mev-commit/` so agents can grep Go source, ABIs, and
protocol types without MCP round-trips. Currently tracks `main` — the
lock file at `.external/.manifest.lock.json` records the current SHA
and age.

## When to load this skill

- Editing `src/app/api/fastswap/route.ts`, `src/hooks/use-swap-intent.ts`,
  or anything else that shapes the JSON payload sent to the FastSwap
  HTTP API
- Debugging a preconf-status error (`src/hooks/use-wait-for-tx-confirmation.ts`,
  `src/lib/settlement/rpc-status.ts`) where the root cause is upstream
  commitment or sender behavior
- Investigating a miles discrepancy — where a swap executed but the
  user's Fuul balance didn't update as expected
- Syncing a local ABI under `contracts-abi/abi/` or
  `src/lib/tokens/*-abi.ts` with an upstream change
- Reading Solidity source to understand a specific revert reason

## Hard rules

- **Never write to `.external/`.** It's a vendored mirror. The pre-commit
  hook (`.claude/hooks/pre-commit-external-guard.sh`) will reject the
  commit anyway. Edits belong in the real mev-commit repo + a separate
  PR.
- **Never import from `.external/` at build time.** The path is
  gitignored; production builds won't have it.
- **Check freshness before relying on a citation.** `/prime` and
  `/sync-externals` both print the current SHA and age. If it's more
  than 7 days old, run `/sync-externals` before using it as a source
  of truth.

## Navigation — where to look inside `.external/mev-commit/`

The **authoritative scope map** is at
[`agent_docs/external-mev-commit.md`](../../../agent_docs/external-mev-commit.md)
— open that first on any non-trivial mev-commit question. It includes
the full endpoint-to-handler table, the miles/Fuul flow diagram, and
a reverse table mapping every Fast Protocol App file to its upstream
counterpart.

Quick-reference subtopics:

- [`contracts.md`](./contracts.md) — Solidity source (`contracts/contracts/`)
- [`abis.md`](./abis.md) — canonical ABI JSON and drift policy
- [`protocol-types.md`](./protocol-types.md) — Go types + preconf RPC handlers

## First move on any cross-repo question

Don't grep blindly. The table in `agent_docs/external-mev-commit.md`
under "Pointers back into Fast Protocol App" maps every dapp file to
its mev-commit source. Check that table first; it's faster than a
recursive grep, and it's maintained with every externals-related PR.
