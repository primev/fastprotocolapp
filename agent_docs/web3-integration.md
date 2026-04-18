# Web3 integration

Map of where wagmi / viem / RainbowKit / ethers are wired. Load this when
editing swap, wallet, or on-chain-read code. For **how-to** guidance (patterns,
do/don't, code snippets), open the `web3-wallet` or `defi-swap` skill —
this file is the pointer layer.

## Core config

- **Chains + transports + connectors**: `src/lib/wagmi.ts`
- **Wallet provider plumbing**: `src/lib/wallet-provider.ts`
- **Provider tree**: `src/components/providers.tsx` — mounts `WagmiProvider`,
  `RainbowKitProvider`, `QueryClientProvider`
- **Network defaults**: `src/lib/config/network.ts`
- **Contract addresses + typed bindings**: `src/lib/contract-config.tsx`
- **Server-side contract helpers**: `src/lib/contract-server.ts`

## Reading state

- Balances: `src/hooks/use-token-balances.ts`
- Wallet info: `src/hooks/use-wallet-info.ts`, `use-wallet-connection.ts`
- Chain/RPC health: `src/hooks/use-rpc-test.ts`, `use-rpc-setup.ts`
- Read-only contract calls: `src/hooks/use-read-only-contract-call.ts`

Rule of thumb: prefer wagmi hooks (`useReadContract`, `useBalance`,
`useAccount`) over raw viem calls in components. Use viem directly only in
`src/lib/*` utilities and server code.

## Signing and sending

- Swap flow: `src/hooks/use-swap-confirmation.ts`, `use-swap-intent.ts`
- Tx wait: `src/hooks/use-wait-for-tx-confirmation.ts`
- Gas: `src/hooks/use-broadcast-gas-price.tsx`, `use-eth-path-gas-estimate.ts`
- Tx error normalization: `src/lib/settlement/transaction-errors.ts`
- Receipt utilities: `src/lib/settlement/transaction-receipt-utils.ts`
- WETH wrap/unwrap: `src/hooks/use-weth-wrap-unwrap.ts` + `src/lib/tokens/weth-utils.ts`
- Permit2: `src/hooks/use-permit2-allowance.ts`, `use-permit2-nonce.ts`,
  `src/lib/swap/permit2-utils.ts`

## Ethers presence

`ethers@6` is still imported in some paths — don't assume viem is used
everywhere. Before introducing a new ethers or viem call, `grep` for both to
match existing patterns in that area of the tree.

## RainbowKit

RainbowKit wraps wagmi for the connect-wallet UI. Its provider lives in
`providers.tsx`. The connect button is embedded where needed via
`@rainbow-me/rainbowkit`'s `ConnectButton.Custom`.

## Hard constraints

- Do not pass private keys, seed phrases, or signed payloads through logs,
  analytics, or non-essential props.
- Do not hardcode RPC URLs — use `src/lib/config/network.ts` / `wagmi.ts`.
- Do not change signed transaction flows without running the swap-engine
  tests under `tests/lib/swap/` and the confirmation tests in
  `tests/lib/settlement/`.

## See also

- `.claude/skills/web3-wallet/SKILL.md` — wallet-layer how-to
- `.claude/skills/defi-swap/SKILL.md` — swap-engine how-to
- `docs/swap-interface.md` — human-facing UX reference
- `docs/tx-confirmation-flow.md` — human-facing confirmation flow
- `docs/quote-polling-idle-detection.md` — human-facing quote freshness
