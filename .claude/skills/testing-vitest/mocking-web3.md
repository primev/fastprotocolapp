# Mocking web3

Mock at the module boundary. Don't try to spin up a real node or sign real transactions in tests.

## Mocking wagmi hooks

```ts
import { vi } from 'vitest'

vi.mock('wagmi', async () => {
  const actual = await vi.importActual<typeof import('wagmi')>('wagmi')
  return {
    ...actual,
    useAccount: () => ({ address: '0xabc...', isConnected: true }),
    useReadContract: () => ({ data: 42n, isLoading: false }),
  }
})
```

- Preserve non-mocked exports via `...actual` so type exports still work.
- Mock per-test only if different tests need different return values.

## Mocking viem clients

```ts
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: () => ({
      readContract: vi.fn().mockResolvedValue(42n),
      simulateContract: vi.fn().mockResolvedValue({ result: 'ok' }),
    }),
  }
})
```

## Mocking the wagmi config

```ts
vi.mock('@/lib/wagmi', () => ({
  wagmiConfig: { /* minimal fake */ },
  chains: [{ id: 1, name: 'mainnet' }],
}))
```

## Mocking SDKs (Fuul, Barter, EmailOctopus, Alchemy)

Mock at the `src/lib/*` wrapper, not the SDK itself. E.g., `vi.mock('@/lib/fuul', () => ({ trackEvent: vi.fn() }))`. This insulates tests from SDK internals.

## Testing hooks

Use `renderHook` from `@testing-library/react` (install if not present — check `package.json` first). Wrap with the QueryClient provider when testing TanStack Query hooks; a helper in `src/test/utils/` may already exist.

## Anti-patterns

- **Do not** try to hit a live RPC in tests.
- **Do not** mock `fetch` globally — scope it to a test with `vi.spyOn(global, 'fetch')`.
- **Do not** mock `window.ethereum`; wagmi's connectors abstract it away.
- **Do not** fill test addresses with real user addresses; use `0xabc...` placeholders.

## Bigint gotcha

Viem returns `bigint` for uint256. `expect(result).toBe(42)` fails; use `expect(result).toBe(42n)`.
