# External: mev-commit — scope map for Fast Protocol App

> Read this when editing anything that interacts with the Fast RPC /
> FastSwap / preconfirmation / miles layer. mev-commit is the upstream
> protocol repo; Fast Protocol App is one client. This file maps the
> parts of mev-commit the agent actually needs, so you don't have to
> grep the whole 137MB tree.
>
> Vendored read-only under `.external/mev-commit/` by `/prime`. All
> paths below are relative to that root. Tracking `main` (see
> "Freshness" at the bottom) — `/prime` fetches + fast-forwards so
> you're working against the current upstream by default.

## What mev-commit is

mev-commit is the preconfirmation protocol: an encrypted mempool +
validator-opt-in yield layer that lets Ethereum L1 transactions land in
sub-second "pre-confirmed" state before being included in a block.
Written primarily in Go, with Solidity settlement contracts.

Fast Protocol App is one dapp that consumes the preconf infrastructure
via HTTP and JSON-RPC. This doc maps those consumption points back to
their mev-commit sources.

---

## TL;DR — the seven things you probably want

| What you want | Where it lives | What it is |
|---|---|---|
| **The `/fastswap` endpoint handler** | `tools/preconf-rpc/fastswap/fastswap.go` | Parses SwapRequest, builds intent, submits via the sender |
| **HTTP router (`/status`, `/user-transactions`, etc.)** | `tools/preconf-rpc/service/service.go` | Registers every endpoint the dapp calls |
| **Transaction sender** | `tools/preconf-rpc/sender/sender.go` | Submits swaps, sets confidence, manages nonces |
| **Commitment store** (powers `getTransactionCommitments`) | `tools/preconf-rpc/store/store.go` | Mapping from tx hash → preconf commitments |
| **Miles calculator + Fuul submitter** | `tools/fastswap-miles/` (`main.go`, `sweep.go`, `miles.go`) | Reads `IntentExecuted` events → miles → Fuul API |
| **Canonical FastSettlementV3 ABI** | `contracts-abi/abi/FastSettlementV3.abi` | The source of truth our `contracts-abi/abi/` should mirror |
| **Contract source** | `contracts/contracts/FastSettlementV3.sol` (and friends) | Solidity — read when debugging a revert |

---

## Consumption point 1 — the FastSwap HTTP API

Fast Protocol App's `src/app/api/fastswap/route.ts` proxies to
`${FASTSWAP_API_BASE}/fastswap`. That server is **`tools/preconf-rpc`**
in mev-commit.

### Endpoints Fast Protocol App hits

All declared in `tools/preconf-rpc/service/service.go`:

| App route | Method | mev-commit path | Handler |
|---|---|---|---|
| `/api/fastswap` | `POST /fastswap` | `tools/preconf-rpc/service/service.go` → `fastswap.Handler()` | Permit2-signed ERC-20 swap intent |
| `/api/fastswap` (ETH path) | `POST /fastswap/eth` | `service.go` → `fastswap.ETHHandler()` | User-submitted native ETH swap |
| `/api/transaction-status/[hash]` | `GET /status/{txnHash}` | `service.go` inline handler | Preconf + on-chain status for a hash |
| `/api/fastswap-miles/by-address` (partial) | `GET /user-transactions?address=...` | `service.go` inline handler | User's recent FastSwap history |

The **SwapRequest schema** that `/fastswap` expects is in
`tools/preconf-rpc/fastswap/fastswap.go`:

```go
type SwapRequest struct {
  User        common.Address  `json:"user"`
  InputToken  common.Address  `json:"inputToken"`
  OutputToken common.Address  `json:"outputToken"`
  InputAmt    *big.Int        `json:"inputAmt"`
  UserAmtOut  *big.Int        `json:"userAmtOut"`
  Recipient   common.Address  `json:"recipient"`
  Deadline    *big.Int        `json:"deadline"`
  Nonce       *big.Int        `json:"nonce"`
  Signature   []byte          `json:"signature"`
  Slippage    string          `json:"slippage,omitempty"`
}
```

This is the contract our `src/app/api/fastswap/route.ts` must match.
The Zod schema in that route (`fastswapSchema`) should mirror this — if
the upstream adds/renames a field, our Zod drifts and we 400 ourselves.

**When to re-read this file:** every time you touch
`src/app/api/fastswap/route.ts`, `src/hooks/use-swap-intent.ts`, or
`src/lib/swap/permit2-utils.ts` in a way that changes the signature
payload.

## Consumption point 2 — the preconf RPC (`mevcommit_*` namespace)

Fast Protocol App's `src/lib/settlement/rpc-status.ts` polls
`mevcommit_getTransactionCommitments` to decide when to flip a swap
toast from "submitted" to "preconfirmed".

### Mapping

| JSON-RPC method | mev-commit file | Notes |
|---|---|---|
| `mevcommit_getTransactionCommitments(hash)` | `tools/preconf-rpc/handlers/handlers.go` → `GetTransactionCommitments` | Returns `[]*bidderapiv1.Commitment` for a tx hash |
| (store layer) | `tools/preconf-rpc/store/store.go` → `rpcstore.GetTransactionCommitments` | The in-memory / persistent cache commitments live in |
| (RPC server bootstrap) | `tools/preconf-rpc/rpcserver/rpcserver.go` | Where the namespace is registered |

### What errors to expect

When our `use-wait-for-tx-confirmation.ts` sees an RPC error from
`mevcommit_getTransactionCommitments`, the root cause is almost always
in one of:

- `store.go` — persistence-layer failures (timeouts, missing commitments)
- `sender/sender.go` — if the tx was rejected upstream (balance check,
  nonce collision, etc.); the error text surfaces through the RPC
- The `bidderapiv1.Commitment` protobuf — schema mismatch if the bidder
  API evolves

The upstream repo's CI runs `tools/preconf-rpc/handlers/handlers_test.go`
— reading the test cases there is the fastest way to learn the error
shape for a given input.

## Consumption point 3 — FastSwap Miles → Fuul

`tools/fastswap-miles/` is a **separate Go service**, not part of the
preconf-rpc server. It's what actually turns a completed swap into user
miles.

### Flow (per the upstream README)

```
L1 mainnet
   │
   │  1. User swaps via FastRPC → preconf-rpc → FastSettlementV3
   │
   │  2. Contract emits IntentExecuted event
   ▼
fastswap-miles indexer (polls L1 in batches, default 2000 blocks)
   │
   │  3. Filter IntentExecuted events, compute net_profit per swap
   ▼
StarRocks `mevcommit_57173.fastswap_miles` table
   │
   │  4. Sweep: convert realized surplus to miles (90% share)
   │
   │  5. Submit to Fuul API → user's miles balance updates
   ▼
Fuul
```

### File-by-file

| File | Role |
|---|---|
| `tools/fastswap-miles/main.go` | CLI + config flags (dry-run, keystore, etc.) |
| `tools/fastswap-miles/sweep.go` | Reads `IntentExecuted` logs, writes rows to `fastswap_miles` StarRocks table, sweeps tokens |
| `tools/fastswap-miles/miles.go` | Queries `fastswap_miles`, computes miles per user, submits to Fuul |
| `tools/fastswap-miles/README.md` | Authoritative high-level flow doc (open first when debugging miles discrepancies) |

### Where Fast Protocol App fits in this picture

The app **never talks to the miles indexer directly**. It reads the
results via:
- `GET /api/fastswap-miles/by-address` (reads the `fastswap_miles`
  StarRocks table through our analytics layer)
- The Fuul SDK (`@fuul/sdk`, via `src/lib/fuul.ts`) — once
  `fastswap-miles` has submitted, the Fuul API returns the updated
  balance through our `/api/fuul/payouts` proxy.

So if miles look wrong in the UI, the debugging chain is:
1. Our `/api/fastswap-miles/by-address` — right row from StarRocks?
2. `tools/fastswap-miles/sweep.go` — did the event get indexed?
3. `tools/fastswap-miles/miles.go` — did the sweep submit to Fuul?
4. `@fuul/sdk` — is the Fuul balance consistent?

**Read `tools/fastswap-miles/README.md` first** — it has the flow
diagram and field-level math.

## Consumption point 4 — Contract source + canonical ABIs

`contracts-abi/abi/FastSettlementV3.abi` in mev-commit is the source of
truth for our `contracts-abi/abi/FastSettlementV3.abi` (they're supposed
to be bit-identical). The `IntentExecuted` event, `SwapIntent` struct,
and `WITNESS_TYPE_STRING` constant all come from there.

**Drift policy:** the ABI test at
`tests/contracts-abi/abi-drift.test.ts` should be extended (Phase D in
the externals plan) to diff our copy against the vendored upstream
copy and fail loudly on divergence.

For the Solidity side:

| What | Where |
|---|---|
| FastSettlementV3 (settlement contract, where swaps execute) | `contracts/contracts/FastSettlementV3.sol` |
| Intent typehash + WITNESS_TYPE_STRING (load-bearing for EIP-712) | Same file, search for `WITNESS_TYPE_STRING` |
| IFastSettlementV3 interface | `contracts/contracts/IFastSettlementV3.sol` |
| Tests — reference for how upstream itself calls the contract | `contracts/test/` |

When a swap reverts and the revert reason isn't obvious, the fastest
path is `grep -r "revert.*<snippet>" .external/mev-commit/contracts/`.

---

## What NOT to care about (safe to ignore)

These exist in mev-commit but Fast Protocol App never consumes them.
Skip unless specifically asked:

- `p2p/` — the mev-commit node itself (P2P gossip, bid evaluation).
  Unless you're debugging commitment semantics, skip.
- `bridge/` — L1 ↔ mev-commit-chain bridge. Not on the app's path.
- `external/geth` — custom Geth fork. Infrastructure, not a consumer
  surface.
- `infrastructure/` — Docker / deploy configs.
- `testing/`, `tools/backrunner/`, `tools/explorer-submitter/`, most of
  `tools/preconf-rpc/{backrunner,notifier,pricer,blocktracker,bidder}/`
  — internal to the RPC server; none of these have surface area the
  dapp touches.

Sparse-checkout patterns in `.claude/externals.json` should reflect
this. The minimum viable set:

```
/contracts/
/contracts-abi/
/tools/preconf-rpc/fastswap/
/tools/preconf-rpc/service/
/tools/preconf-rpc/handlers/
/tools/preconf-rpc/store/
/tools/preconf-rpc/sender/
/tools/preconf-rpc/rpcserver/
/tools/fastswap-miles/
```

---

## Freshness — tracking `main`

`/prime` **fast-forwards to upstream main** on every invocation:

1. `git fetch --no-tags origin main`
2. If local HEAD has no uncommitted changes and no divergent commits,
   fast-forward it to `origin/main`.
3. If anything would conflict (it shouldn't — we never commit to
   `.external/`), print the divergence and stop.
4. Update `.external/.manifest.lock.json` with the new SHA +
   timestamp.
5. Print summary: `mev-commit @ <short-sha> (N commits fast-forwarded
   since last prime)`.

For explicit resync without a full `/prime` (e.g. after you saw a PR
land upstream), run `/sync-externals`. Same mechanics, just scoped.

**Why we track main and not a SHA pin:** you explicitly want upstream
freshness to be the default posture because the protocol is actively
developed and yesterday's SHA is often wrong by this afternoon. The
safety net is the ABI drift test — when upstream ships an ABI change,
the test fails on the next verify run, which is the signal to
reconcile.

---

## Pointers back into Fast Protocol App

When this doc says "the app has X", the app file is:

| In this repo | In mev-commit |
|---|---|
| `src/app/api/fastswap/route.ts` | `tools/preconf-rpc/fastswap/fastswap.go` |
| `src/app/api/transaction-status/[hash]/route.ts` | `tools/preconf-rpc/service/service.go` (`GET /status/{txnHash}`) |
| `src/app/api/fast-tx-status/[hash]/route.ts` | Same server, different surface (our analytics read) |
| `src/lib/settlement/rpc-status.ts` | `tools/preconf-rpc/handlers/handlers.go` + `store/store.go` |
| `src/hooks/use-wait-for-tx-confirmation.ts` | Consumes `/status` + `mevcommit_getTransactionCommitments` |
| `src/hooks/use-swap-intent.ts` | Generates the payload that `fastswap.go`'s `SwapRequest` parses |
| `src/lib/swap/permit2-utils.ts` | Encodes EIP-712 witness that FastSettlementV3 verifies |
| `src/app/api/fastswap-miles/by-address/route.ts` | `tools/fastswap-miles/` (reads the StarRocks table it populates) |
| `src/app/api/fuul/*` | Fuul API directly (not mev-commit) — but miles data provenance is `fastswap-miles` |
| `contracts-abi/abi/FastSettlementV3.abi` | `contracts-abi/abi/FastSettlementV3.abi` (canonical) |

Keep this table in sync when either side renames a file. The agent's
first move on a cross-repo question should be this table, not a grep.
