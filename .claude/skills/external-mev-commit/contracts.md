# mev-commit Solidity source

Lives at `.external/mev-commit/contracts/contracts/`. Read when a
transaction reverts with an opaque reason and you need to ground the
message in the contract that produced it.

## Layout

```
.external/mev-commit/contracts/
├── contracts/          Solidity source — contracts + interfaces
│   ├── FastSettlementV3.sol          # THE settlement contract; swap entry
│   ├── IFastSettlementV3.sol         # interface (re-exported to our app)
│   └── ...
├── lib/                foundry deps (openzeppelin, etc.)
├── scripts/            deploy scripts
└── test/               foundry tests — useful as reference for how
                        upstream calls the contract it ships
```

## Load-bearing files

- `FastSettlementV3.sol` — executes `executeWithPermit` (ERC-20 flow)
  and `executeWithETH` (native ETH flow). Contains the
  `WITNESS_TYPE_STRING` constant our `src/lib/swap/permit2-utils.ts`
  must match byte-for-byte, and emits `IntentExecuted` (the event
  `fastswap-miles` indexes).
- `IFastSettlementV3.sol` — interface. Mirrors the typed structs
  (`Intent`, `SwapCall`, `TokenPermissions`) we declare in
  `src/types/swap.ts`. If the interface changes, our types drift.
- `test/*.sol` — Foundry tests. Best reference for *how* upstream
  expects the contract to be called, including edge cases and
  expected reverts.

## Debugging a revert

1. `grep -rn "revert" .external/mev-commit/contracts/contracts/` to
   list every revert site.
2. Match on the hex selector or the string in the error message.
3. Read the surrounding function to understand the precondition that
   failed.

For EIP-712-related reverts ("invalid signature", "permit expired"),
also read `src/lib/swap/permit2-utils.ts` in THIS repo and compare
against `WITNESS_TYPE_STRING` in `FastSettlementV3.sol` — any
single-character mismatch breaks every signature.
