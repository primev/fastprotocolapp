# INVARIANTS.md

Load-bearing contracts the Fast Protocol App upholds. Every entry
below is **enforced by a test** — the link is the oracle. When an
invariant ever stops holding, the test should be the first thing that
fails.

This file exists so agents can load "what are the rules of this
system" in one read, instead of grepping property tests. Keep it
sorted by domain; keep each entry to one sentence.

---

## API input validation (Zod boundary)

| Invariant | Enforced by |
|---|---|
| `walletAddressSchema.parse` is idempotent and lower-cases — `parse(parse(x)) === parse(x) === x.toLowerCase()` | [`tests/lib/api/schemas.test.ts`](./tests/lib/api/schemas.test.ts) |
| `txHashSchema` rejects 20-byte hex (i.e., a wallet address cannot be accepted as a tx hash) | [`tests/lib/api/schemas.test.ts`](./tests/lib/api/schemas.test.ts) |
| `tokenSymbolSchema` output is always uppercase and ≤16 chars (the CSS chip width relies on this) | [`tests/lib/api/schemas.test.ts`](./tests/lib/api/schemas.test.ts) |
| `paginationSchema` output is always in `{ offset ∈ [0, 1_000_000], limit ∈ [1, 200] }` — a caller cannot request arbitrarily large slabs | [`tests/lib/api/schemas.test.ts`](./tests/lib/api/schemas.test.ts) |
| Every parsed wallet address passes `viem.isAddress` | [`tests/invariants/cross-module.test.ts`](./tests/invariants/cross-module.test.ts) |
| Every 400 response from `@/lib/api/parse` carries a structured `{ error: "Invalid request", issues: [{ path, message }, ...] }` shape | [`tests/invariants/cross-module.test.ts`](./tests/invariants/cross-module.test.ts) |

## Slippage math (contract safety)

| Invariant | Enforced by |
|---|---|
| exactIn `slippageLimit ≤ amountOut` always — the minimum-received floor is never higher than what the quote said | [`tests/lib/swap/slippage.test.ts`](./tests/lib/swap/slippage.test.ts) |
| exactOut `slippageLimit ≥ amountIn` always — the maximum-paid ceiling is never lower than what the quote said | [`tests/lib/swap/slippage.test.ts`](./tests/lib/swap/slippage.test.ts) |
| Slippage limit is always non-negative for any (amount, bps) combination — prevents uint256 underflow on the contract side | [`tests/lib/swap/slippage.test.ts`](./tests/lib/swap/slippage.test.ts) |
| Slippage is monotone in bps — more tolerance → lower exactIn floor, higher exactOut ceiling | [`tests/lib/swap/slippage.test.ts`](./tests/lib/swap/slippage.test.ts) |
| 100% slippage on exactIn collapses to zero (boundary correctness) | [`tests/lib/swap/slippage.test.ts`](./tests/lib/swap/slippage.test.ts) |

## EIP-712 signing (Permit2 witness)

| Invariant | Enforced by |
|---|---|
| The three typed-data blocks (`PermitWitnessTransferFrom`, `TokenPermissions`, `Intent`) have exactly the expected fields in exactly the expected order | [`tests/lib/swap/permit2-utils.test.ts`](./tests/lib/swap/permit2-utils.test.ts) |
| `INTENT_WITNESS_TYPE_STRING` starts with `"Intent witness)"` and declares `Intent(...)` + `TokenPermissions(...)` with the canonical field list | [`tests/lib/swap/permit2-utils.test.ts`](./tests/lib/swap/permit2-utils.test.ts) |
| `keccak256(INTENT_WITNESS_TYPE_STRING) === 0x42a3c5ff84f3c363ecd3e4c67c095aa17cfac2a704b64eeeddfa3cf0927f1e5f` (golden snapshot) | [`tests/lib/swap/permit2-utils.test.ts`](./tests/lib/swap/permit2-utils.test.ts) |
| `hashTypedData(GOLDEN)` produces the fixed bytes32 `0x856bd73c6a5ce67f114fb859ab1f4dd082445821c0263268e5a74c66fd91c1a7` — any field change moves the hash | [`tests/lib/swap/permit2-utils.test.ts`](./tests/lib/swap/permit2-utils.test.ts) |
| The Permit2 mainnet domain separator equals `0x866a5aba21966af95d6c7ab78eb2b2fc913915c28be3b9aa07cc04ff903e3f28` — verified against the on-chain contract by the fork test | [`tests/fork/permit2.fork.test.ts`](./tests/fork/permit2.fork.test.ts) |
| Distinct `user` / `nonce` / `deadline` produce distinct typed-data hashes — the replay-protection invariant | [`tests/lib/swap/permit2-utils.test.ts`](./tests/lib/swap/permit2-utils.test.ts) |

## Token resolution (swap engine ↔ Uniswap quoter)

| Invariant | Enforced by |
|---|---|
| Any ETH-like input (zero-address sentinel, symbol `"ETH"` case-insensitive) resolves to `WETH_ADDRESS` — the Uniswap quoter cannot accept native ETH | [`tests/lib/tokens/token-resolver.test.ts`](./tests/lib/tokens/token-resolver.test.ts) |
| `resolveTokenAddress` is total — no input combination throws | [`tests/lib/tokens/token-resolver.test.ts`](./tests/lib/tokens/token-resolver.test.ts) |
| `resolveTokenDecimals` always returns a non-negative integer, defaulting to 18 for nullish / missing inputs | [`tests/lib/tokens/token-resolver.test.ts`](./tests/lib/tokens/token-resolver.test.ts) |
| `isNativeETH` returns `boolean` for any input — rendering helpers depend on this never throwing | [`tests/lib/tokens/token-resolver.test.ts`](./tests/lib/tokens/token-resolver.test.ts) |

## Wrap / unwrap detection

| Invariant | Enforced by |
|---|---|
| `isWrapUnwrapPair(a, b) === isWrapOperation(a, b) || isUnwrapOperation(a, b)` (exact disjunction) | [`tests/lib/tokens/weth-utils.test.ts`](./tests/lib/tokens/weth-utils.test.ts) |
| For any single ordered pair, wrap and unwrap are **mutually exclusive** — can't be both at once | [`tests/lib/tokens/weth-utils.test.ts`](./tests/lib/tokens/weth-utils.test.ts) |
| Any ETH/WETH pair (either direction) has both sides resolving to `WETH_ADDRESS` — the quoter-bypass short-circuit depends on this | [`tests/invariants/cross-module.test.ts`](./tests/invariants/cross-module.test.ts) |
| Swapping the argument order of `isWrapOperation` yields `isUnwrapOperation` for ETH↔WETH pairs (directional symmetry) | [`tests/lib/tokens/weth-utils.test.ts`](./tests/lib/tokens/weth-utils.test.ts) |

## Stablecoin detection (display formatting)

| Invariant | Enforced by |
|---|---|
| `isStablecoin` is total — no input combination throws on the render path | [`tests/lib/tokens/stablecoins.test.ts`](./tests/lib/tokens/stablecoins.test.ts) |
| `isStablecoin` always returns a `boolean` (never null/undefined/NaN) | [`tests/lib/tokens/stablecoins.test.ts`](./tests/lib/tokens/stablecoins.test.ts) |
| Case-insensitive on both the address and symbol arguments | [`tests/lib/tokens/stablecoins.test.ts`](./tests/lib/tokens/stablecoins.test.ts) |

## Leaderboard pagination

| Invariant | Enforced by |
|---|---|
| `buildPageNumbers(current, total)` has first element `1` and last element `total` | [`tests/components/dashboard/leaderboard/paginate.test.ts`](./tests/components/dashboard/leaderboard/paginate.test.ts) |
| The numeric subsequence is strictly increasing (pagination never shows `[1, 5, 3, …]`) | [`tests/components/dashboard/leaderboard/paginate.test.ts`](./tests/components/dashboard/leaderboard/paginate.test.ts) |
| No two consecutive `…` entries (wasted render slots) | [`tests/components/dashboard/leaderboard/paginate.test.ts`](./tests/components/dashboard/leaderboard/paginate.test.ts) |
| `current` always appears in the rendered sequence (user is never visually lost) | [`tests/components/dashboard/leaderboard/paginate.test.ts`](./tests/components/dashboard/leaderboard/paginate.test.ts) |
| Output length is bounded — ≤ 7 entries for any input | [`tests/components/dashboard/leaderboard/paginate.test.ts`](./tests/components/dashboard/leaderboard/paginate.test.ts) |
| `buildPageNumbers` output contains every page adjacent to `current` — agents can always reach neighbor in one click | [`tests/invariants/cross-module.test.ts`](./tests/invariants/cross-module.test.ts) |

## Upstream API contracts (runtime-validated)

| Invariant | Enforced by |
|---|---|
| Fuul `/leaderboard/points` response entries must carry `address`, `user_identifier`, `total_amount`, `total_attributions`, `rank` — missing required fields trigger a structured 502 from our proxy | [`tests/lib/api/upstream.test.ts`](./tests/lib/api/upstream.test.ts) |
| Fuul `/payouts/totals/{addr}` coerces `total_points` from string → number (handles legacy field renames `total_payouts` / `total` / `points` as fallbacks) | [`tests/lib/api/upstream.test.ts`](./tests/lib/api/upstream.test.ts) |
| Barter `/route` requires `outputWithGasAmount` AND `gasEstimation` — missing either → 502 (never quote an unpriced swap) | [`tests/lib/api/upstream.test.ts`](./tests/lib/api/upstream.test.ts) |

## ABI drift guard

| Invariant | Enforced by |
|---|---|
| Every JSON ABI under `contracts-abi/abi/` parses and every entry has a valid `type` / `inputs` / `outputs` / `stateMutability` | [`tests/contracts-abi/abi-drift.test.ts`](./tests/contracts-abi/abi-drift.test.ts) |
| `WETH_ABI` declares `deposit()` payable, `withdraw(uint256)` nonpayable, `balanceOf(address)` view returning `uint256` | [`tests/contracts-abi/abi-drift.test.ts`](./tests/contracts-abi/abi-drift.test.ts) |
| `ERC20_APPROVE_ABI` declares `approve(address,uint256)` returning `bool` and `allowance(address,address)` view returning `uint256` | [`tests/contracts-abi/abi-drift.test.ts`](./tests/contracts-abi/abi-drift.test.ts) |
| When `.external/mev-commit/contracts-abi/abi/` is present, every local ABI that has an upstream counterpart is byte-identical (semantic JSON equality) to upstream | [`tests/contracts-abi/abi-drift.test.ts`](./tests/contracts-abi/abi-drift.test.ts) (skipped without `/sync-externals`) |

---

## How to add an invariant

1. Write the test first. If the invariant can be expressed as a
   property, use `fast-check` — it's more trustworthy than
   example-based tests for "always true" claims.
2. Place it in the most specific test file: domain-local invariants
   in `tests/lib/<domain>/<module>.test.ts`, cross-module invariants
   in `tests/invariants/cross-module.test.ts`.
3. Add a row to the matching section above with the one-sentence
   invariant and a link to the test file.
4. Keep the table alphabetical within each section so diffs stay
   small.

When an invariant ever needs to change, the test change is the
load-bearing signal — update the test, then this doc. Never the other
way around.
