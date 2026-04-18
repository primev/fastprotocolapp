# Glossary

Domain terms as they're used in this codebase. Keeps skills and CLAUDE.md from redefining them.

### Fast Protocol
A coordinated rewards layer on Ethereum L1 with sub-second swaps and tokenized MEV rewards. "Fast" is the protocol brand; "Fast RPC" is its RPC endpoint.

### Fast RPC
The protocol's custom RPC endpoint. Users install it in MetaMask / Rabby via one-click flow (`network-checker/`, `use-network-installation`, `use-add-fast-to-metamask`). Health surfaced via `src/lib/fast-rpc-status.ts`.

### SBT — Soul Bound Token
Non-transferable ERC-721 (ERC-5192-style) that represents user participation. The **Genesis SBT** is the launch badge. Mint flow: `src/app/claim/` + `src/hooks/use-genesis-sbt.ts` + `use-minting.ts`.

### Permit2
Uniswap's signature-based approval system. Used here so users approve once and swap multiple times without per-tx approval gas. See `src/lib/permit2-utils.ts` + `src/hooks/use-permit2-allowance.ts` + `use-permit2-nonce.ts`. Deadlines matter — always respect `deadline` fields.

### Miles
User reward points. Tracked via **Fuul** SDK (`@fuul/sdk`, `src/lib/fuul.ts`, `src/lib/miles-events.ts`). Estimated client-side via `src/hooks/use-estimated-miles.ts`. The `show_miles_estimate` feature flag (in `src/lib/feature-flags.ts`) gates miles UI.

### Fuul
Third-party referral/rewards SDK. Source of leaderboard + miles data for some views. See `src/lib/fuul.ts`, `src/hooks/use-fuul-miles-leaderboard.ts`.

### Leaderboard tiers
**Gold / Silver / Bronze** — volume-based. Config in `src/lib/leaderboard-config.ts`. Feature logic in `src/hooks/use-leaderboard-data.ts`. Deep-dive: `docs/leaderboard-queries.md`.

### Genesis claim
The Genesis SBT minting ceremony. Routes under `src/app/claim/`; logic in `use-genesis-sbt.ts` + `use-minting.ts` + components under `src/components/claim/`.

### Barter
External token-support API. See `src/lib/barter-api.ts`, `src/lib/barter-supported-tokens.ts`, `src/hooks/use-barter-validation.ts`.

### Hyperliquid
Integration referenced in `src/app/api/hyperliquid/`. External DEX data source.

### Surplus
MEV surplus rate captured by the swap → returned to user as miles. See `src/hooks/use-surplus-rate.ts` and `docs/miles-estimation.md`.

### Preconfirm / preconfirmation
Sub-second transaction commitment. UX cue: `src/components/swap/PreconfirmCelebration.tsx` + `src/lib/preconfirm-sound.ts`. Tech background: Primev mev-commit protocol (the parent org).

### Quote guard
Staleness check for swap quotes. `src/lib/quote-guard.ts` + `src/hooks/use-quote-guard-config.ts`. See `docs/quote-polling-idle-detection.md`.

### Gate / whitelist / waitlist
Access-control stages. Hooks: `use-gate-status`, `use-whitelist`, `use-waitlist`, `use-waitlist-position`. Data: `src/lib/gate-data.ts` + Vercel Edge Config.

### Affiliate code
Referral code a user enters or is assigned. `use-affiliate-code.ts`, `use-accepted-invite.ts`.

### Fast Settlement (v2.1 / v3)
The on-chain settlement contract versions the app can target. ABIs in `src/lib/fast-settlement-v2-1.ts` and `fast-settlement-v3-abi.ts`.

### ETH path
Swap routing that originates from or terminates in native ETH (vs ERC-20). See `src/lib/eth-path-tx.ts`, `use-eth-path-gas-estimate.ts`.

### WETH wrap/unwrap
Converting between ETH and WETH via the canonical WETH9 contract. `src/lib/weth-abi.ts`, `src/lib/weth-utils.ts`, `src/hooks/use-weth-wrap-unwrap.ts`.
