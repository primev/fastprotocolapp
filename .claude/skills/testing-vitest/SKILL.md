---
name: testing-vitest
description: Use when writing, running, or debugging Vitest tests in this repo. Covers where tests live (top-level tests/ directory mirroring src/), how to mock wagmi/viem, and the test-runner commands that agents should use (test:run, not watch). The post-edit-test.sh hook auto-runs related tests on save.
---

# Testing with Vitest

## When to use

- Writing a new test
- Debugging a failing test
- Setting up mocks for wagmi / viem / external SDKs
- Tuning `vitest.config.ts` or `tests/utils/`

## Key files

- Config: `vitest.config.ts`
- Helpers: `tests/utils/` (check here before writing your own)
- Existing tests: `tests/` (mirrors `src/`)

## References

- Layout + naming: [`test-layout.md`](./test-layout.md)
- Mocking web3: [`mocking-web3.md`](./mocking-web3.md)
- Overview: `agent_docs/testing.md`
- Repo convention: `tests/README.md`

## Workflow

1. Check `tests/utils/` for an existing helper (renderer, mock factory) before
   writing a new one.
2. Mirror the source path: `src/lib/swap/quote-guard.ts` →
   `tests/lib/swap/quote-guard.test.ts`. The auto-run hook relies on this
   mapping.
3. Name the file `<module>.test.ts` (or `.tsx` for components).
4. Use the `@/` alias for imports from `src/`; use relative paths for
   helpers under `tests/utils/`.
5. Prefer `test:run` (single-pass) over `test` (watch) — always from an agent.
6. When a test fails, read the actual error before re-running — flaky re-runs
   waste context.

## Quick commands

```bash
npm run test:run                         # all tests, single pass
npm run test:run -- tests/lib/swap/...   # a single file or glob
npm run test:coverage                    # coverage report (v8)
```

## Guardrails

- **Do not use `npm run test` (watch) from an agent.** It never exits.
- **Do not mock modules you don't own** beyond the surface you need —
  over-mocking breaks when deps update.
- **Do not inject real API keys** (even in `.env.test.local`). Use placeholder
  strings.
- **Do not test framework internals** (wagmi's `useAccount` return shape) —
  test your own logic.

## Verification

- `npm run test:run` before declaring the change complete.
- For CI-parity, also run `npm run typecheck` — tests can pass while types break.
- The `post-edit-test.sh` hook runs the matching mirror test automatically on
  edit; `post-edit-typecheck.sh` runs `tsc --noEmit`. Silent on success.
