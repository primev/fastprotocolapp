---
name: testing-vitest
description: Use when writing, running, or debugging Vitest tests in this repo. Covers where tests live (src/lib/__tests__/ colocation), how to mock wagmi/viem, and the test-runner commands that agents should use (test:run, not watch).
---

# Testing with Vitest

## When to use

- Writing a new test
- Debugging a failing test
- Setting up mocks for wagmi / viem / external SDKs
- Tuning `vitest.config.ts` or `src/test/utils/`

## Key files

- Config: `vitest.config.ts`
- Helpers: `src/test/utils/` (check here before writing your own)
- Existing tests: `src/lib/__tests__/`

## References

- Layout + naming: [`test-layout.md`](./test-layout.md)
- Mocking web3: [`mocking-web3.md`](./mocking-web3.md)
- Overview: `agent_docs/testing.md`

## Workflow

1. Check `src/test/utils/` for an existing helper (renderer, mock factory) before writing a new one.
2. Colocate: put tests in `__tests__/` next to the module under test.
3. Name the file `<module>.test.ts`.
4. Prefer `test:run` (single-pass) over `test` (watch) — always from the agent side.
5. When a test fails, read the actual error before re-running — flaky re-runs waste context.

## Quick commands

```bash
npm run test:run                          # all tests, single pass
npm run test:run -- src/lib/__tests__/x   # a single file
npm run test:coverage                     # coverage report
```

## Guardrails

- **Do not use `npm run test` (watch) from an agent.** It never exits.
- **Do not mock modules you don't own** beyond the surface you need — over-mocking breaks when deps update.
- **Do not inject real API keys** (even in `.env.test.local`). Use placeholder strings.
- **Do not test framework internals** (wagmi's `useAccount` return shape) — test your own logic.

## Verification

- `npm run test:run` before declaring the change complete.
- For CI-parity, also run `npm run typecheck` — tests can pass while types break.
