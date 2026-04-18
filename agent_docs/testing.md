# Testing

Vitest 4. Config: `vitest.config.ts`. For **how to write / mock / organize**
tests, open the `testing-vitest` skill; this file is the map.

## Layout

All tests live under the top-level `tests/` directory, mirroring `src/`:

```
tests/
├── api/          <- src/app/api/<route>/route.ts
├── components/   <- src/components/**
├── hooks/        <- src/hooks/**
├── lib/          <- src/lib/**
│   ├── api/
│   ├── settlement/
│   ├── swap/
│   └── tokens/
└── utils/        <- shared helpers (excluded from discovery)
```

The `post-edit-test.sh` hook looks up `tests/<mirror>.test.*` first when a
source file is edited, so saving `src/lib/swap/quote-guard.ts` auto-runs
`tests/lib/swap/quote-guard.test.ts` if it exists.

## Running

```bash
npm run test           # watch mode (interactive only)
npm run test:run       # single pass — use this in CI and for agent verification
npm run test:coverage  # single pass with coverage
```

Agents must always use `test:run`. Watch mode hangs the terminal.

## What to test

- Pure utilities in `src/lib/**` — **yes**, highest ROI.
- Hooks with non-trivial logic — yes. Mock wagmi/viem at the module boundary.
- Components — currently sparse; mirror existing patterns.
- API routes — yes, especially anything that takes user input (now Zod-validated
  via `@/lib/api/parse`). See `tests/api/user-onboarding.test.ts` for pattern.
- Web3 calls — mock wagmi/viem at the module boundary. Never spin up anvil.

## Mocking

- Mock wagmi hooks where imported, not globally.
- Mock viem `createPublicClient` / `createWalletClient` at the module level.
- `vi.mock('@/lib/wagmi', …)` pattern for core config.
- Never inject real API keys; use placeholder strings.

## Anti-patterns

- Don't mock the whole DOM — JSDOM is fine for components.
- Don't assert on precise strings from third-party libs (viem error messages,
  etc.) — they change.
- Don't run `test` (watch) in CI or from an agent — use `test:run`.

## See also

- `.claude/skills/testing-vitest/SKILL.md` — how-to
- `tests/README.md` — naming + import conventions
- `tests/utils/` — current shared helpers
