# mev-commit ABIs and drift policy

The canonical ABI JSON lives at
`.external/mev-commit/contracts-abi/abi/`. Our local copies under
`contracts-abi/abi/` in THIS repo are supposed to be bit-identical
copies of those files.

## What's there

Both directories contain the same two files:

| File | What it is |
|---|---|
| `FastSettlementV3.abi` | Full ABI: functions + events, including `IntentExecuted` and the `executeWith*` entry points |
| `IFastSettlementV3.abi` | Interface-only ABI |

## Drift policy

The ABI drift test at `tests/contracts-abi/abi-drift.test.ts`:

1. Validates shape (every entry has `type`, functions have `inputs` /
   `outputs` / `stateMutability`, etc.).
2. When `.external/mev-commit/contracts-abi/abi/` is present (i.e., an
   agent has run `/prime`), diffs each of OUR files byte-for-byte
   against the upstream copy. Divergence fails the test.

This means: **never hand-edit `contracts-abi/abi/*.abi`**. If upstream
changes an ABI:

1. Run `/sync-externals` to pull the new upstream.
2. Copy the updated JSON from `.external/mev-commit/contracts-abi/abi/`
   into THIS repo's `contracts-abi/abi/`.
3. Regenerate or hand-update the TypeScript ABI bindings in
   `src/lib/tokens/*-abi.ts` if the change affects their surface.
4. Run `npm run test:run` — the drift test should pass again, and any
   typed-ABI consumer whose call shape changed will fail elsewhere so
   you know what to fix.

## The generated Go client

`.external/mev-commit/contracts-abi/clients/FastSettlementV3/FastSettlementV3.go`
is the abigen-generated Go binding. Fast Protocol App doesn't use it
directly, but it's the fastest way to see the *canonical* Go struct
layouts for `Intent`, `SwapCall`, and event payloads — the upstream
Go services (including `fastswap-miles` and the preconf-rpc server)
consume it, so it's the ground truth for struct ordering.
