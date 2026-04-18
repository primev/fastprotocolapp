# Testing

Vitest 4. Config: `vitest.config.ts`.

## Layout

- Test runner config: `vitest.config.ts`
- Shared test utilities: `src/test/utils/`
- Colocated tests: `src/lib/__tests__/*.test.ts` (current convention)
- Coverage provider: `@vitest/coverage-v8`

Tests next to the code they cover in `__tests__/` dirs. Do not create a parallel `tests/` root.

## Running

```bash
npm run test           # watch mode (interactive)
npm run test:run       # single pass (use this in CI and for agent verification)
npm run test:coverage  # single pass with coverage
```

Agents should always use `test:run` to avoid hanging on the watcher.

## What to test

- Pure utilities in `src/lib/*` — **yes**, prefer these first.
- Hooks that contain non-trivial logic — yes, with `@testing-library/react-hooks` style wrappers (check `src/test/utils/` for helpers first).
- Components — currently sparse; match existing patterns if you add one.
- Web3 calls — mock wagmi/viem at the module boundary. Do not try to spin up an anvil node.

## Mocking

- Mock wagmi hooks where they're imported, not at the global level.
- Mock viem `createPublicClient` / `createWalletClient` at the module level.
- Use `vi.mock('@/lib/wagmi', …)` pattern for core config.
- Never inject real API keys into tests. Use placeholder strings.

## Anti-patterns

- Don't mock the whole DOM — JSDOM is fine for most components.
- Don't assert on precise strings from third-party libs (viem error messages, etc.) — they change.
- Don't run `test` (watch) in CI or from an agent — use `test:run`.

## See also

- `.claude/skills/testing-vitest/SKILL.md`
- `src/test/utils/` — current helpers
