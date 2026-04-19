# mev-commit protocol types + RPC handlers

Go source for everything Fast Protocol App consumes over HTTP or
JSON-RPC. All paths below are under `.external/mev-commit/`.

## HTTP surface — `tools/preconf-rpc/`

`tools/preconf-rpc/service/service.go` is the HTTP router. Registers:

| Method + path | Handler source |
|---|---|
| `POST /fastswap` | `fastswap.Handler()` in `tools/preconf-rpc/fastswap/fastswap.go` |
| `POST /fastswap/eth` | `fastswap.ETHHandler()` same file |
| `GET /status/{txnHash}` | inline in `service.go` |
| `GET /user-transactions` | inline in `service.go` |
| `mevcommit_*` JSON-RPC namespace | `tools/preconf-rpc/handlers/handlers.go` |

### `SwapRequest` schema — the contract our `/api/fastswap` must match

In `tools/preconf-rpc/fastswap/fastswap.go`:

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
  Signature   []byte          `json:"signature"`    // EIP-712 Permit2
  Slippage    string          `json:"slippage,omitempty"`
}
```

Our `fastswapSchema` in `src/app/api/fastswap/route.ts` must mirror
this shape. Adding / renaming a field upstream without updating our
Zod schema results in us 400-ing ourselves before the request even
leaves.

### Preconf RPC errors

`tools/preconf-rpc/handlers/handlers.go` declares
`GetTransactionCommitments(ctx, txnHash) ([]*bidderapiv1.Commitment,
error)`. Errors here bubble up to our
`src/lib/settlement/rpc-status.ts` polling loop. The most common
sources:

- `tools/preconf-rpc/store/store.go` — persistence-layer timeouts or
  missing commitments
- `tools/preconf-rpc/sender/sender.go` — tx rejected upstream (balance
  check, nonce collision, invalid signature); the error string
  surfaces through the RPC response

When you see an unfamiliar error string in the app, `grep -rn "<string>"
.external/mev-commit/tools/preconf-rpc/` will land you on the source.

## Miles indexer — `tools/fastswap-miles/`

Separate Go service, NOT part of the preconf-rpc server. This is where
a completed swap becomes Fuul miles.

Read order when debugging miles:

1. `tools/fastswap-miles/README.md` — authoritative flow diagram and
   the net-profit formula
2. `tools/fastswap-miles/sweep.go` — L1 indexer + StarRocks insert
   (populates the `mevcommit_57173.fastswap_miles` table that our
   `/api/fastswap-miles/by-address` reads)
3. `tools/fastswap-miles/miles.go` — computes miles per user, submits
   to Fuul API

Fast Protocol App never talks to this service directly; it reads the
results via the StarRocks analytics layer and the Fuul SDK. The
debugging chain for "user's miles look wrong":

```
UI → /api/fastswap-miles/by-address → StarRocks table
       ↑
       fastswap-miles/sweep.go wrote it (or didn't)
       ↑
       FastSettlementV3 emitted IntentExecuted (or didn't)
```

## What to ignore inside `tools/preconf-rpc/`

Sparse-checkout pulls in the points/ subdir for completeness but Fast
Protocol App doesn't consume it directly yet. Also skip:
- `backrunner/`, `notifier/`, `pricer/`, `blocktracker/`, `bidder/` —
  internal to the RPC server, not consumer surface.
- `main.go` — entrypoint / CLI, not logic.
