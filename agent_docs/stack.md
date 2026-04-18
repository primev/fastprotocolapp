# Stack

Authoritative values: `package.json`. This file is the agent's cheat sheet.

## Versions that matter

| Concern | Library | Version |
|---|---|---|
| Framework | `next` | ^15.5.7 (App Router) |
| UI | `react` / `react-dom` | ^18.3.1 |
| Language | `typescript` | ^5.8.3 (**strict mode off** — `tsconfig.json`) |
| Web3 client | `wagmi` | ^2.19.5 |
| EVM primitives | `viem` | ^2.40.4 |
| Wallet UI | `@rainbow-me/rainbowkit` | ^2.2.9 |
| Legacy web3 | `ethers` | ^6.16.0 (some paths still use this) |
| Server data | `@tanstack/react-query` | ^5.83.0 |
| Local state | `zustand` | ^5.0.3 (minimal — `src/stores/swapToastStore.ts` only) |
| Env validation | `@t3-oss/env-nextjs` | ^0.13.8 |
| Schema | `zod` | ^3.25.76 |
| Styles | `tailwindcss` | ^3.4.17 |
| Components | Radix UI + shadcn/ui | (many `@radix-ui/*` packages) |
| Tests | `vitest` | ^4.0.16 |
| Lint | `eslint` | ^9.32.0 (flat config: `eslint.config.js`) |
| Format | `prettier` | ^3.7.4 (`.prettierrc`) |

## Scripts (from `package.json`)

```
dev           next dev
build         next build
start         next start
lint          next lint
typecheck     tsc --noEmit          (added by agentic-repo-design)
test          vitest (watch)
test:run      vitest run
test:coverage vitest run --coverage
format        prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"
format:check  prettier --check "src/**/*.{ts,tsx,js,jsx,json,css,md}"
stablecoins   tsx scripts/getStablecoins.ts
```

## Quirks — read these before you're surprised

- **TS strict mode is OFF.** `tsconfig.json` sets `strict: false`, `noImplicitAny: false`. Expect `any` drift and `null` sloppiness. Do not "fix" this wholesale.
- **Package manager is npm.** `package-lock.json` is authoritative. `bun.lockb` used to exist and has been removed — do not regenerate it. CI (`.github/workflows/format.yml`) runs `npm ci`.
- **Path alias**: `@/*` → `src/*` (see `tsconfig.json`).
- **Env validation runs at build.** `src/env/server.ts` uses t3-oss; `next.config.mjs` uses jiti to load it during config eval.
- **Next 15 + React 18** (not 19). Server actions are available. `use client` directives are required on any file that uses hooks/state.
- **ESLint warnings only.** `eslint-plugin-only-warn` is installed — rule violations won't fail builds locally. CI may be stricter.
- **Solidity side is Foundry-based** under `contracts/` with `forge` tooling. The app does not compile contracts — it consumes ABIs from `contracts-abi/`.

## Runtime environment

- Node 20+ recommended (Next 15 requirement).
- Deploys via Vercel (`vercel.json` present).
- Vercel Edge Config, Blob, and Speed Insights are wired in.

## See also

- `agent_docs/env-vars.md` — environment variables and where they're consumed
- `agent_docs/architecture.md` — directory map
