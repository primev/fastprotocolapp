# Hook patterns

## Shape of a data hook

```ts
// src/hooks/use-example.ts
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'

export function useExample() {
  const { address } = useAccount()
  return useQuery({
    queryKey: ['example', address],           // stable, address-scoped
    queryFn: () => fetchExample(address!),    // pure
    enabled: Boolean(address),                // don't fire without deps
    staleTime: 30_000,                         // tune per data
  })
}
```

## Shape of a mutation hook

```ts
// src/hooks/use-example-mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useExampleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => postExample(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['example'] })
    },
  })
}
```

## Composition hooks (hooks that compose other hooks)

Many swap hooks compose multiple primitives. Rules:

- The outer hook is the orchestrator; inner hooks fire independently.
- Return a discriminated union for state: `{ status: 'idle' } | { status: 'loading' } | ...`, not loose booleans.
- Isolate side effects in `useEffect`; never fire a side effect in the render path.

## Reading wagmi inside a hook

- Import `useAccount`, `useChainId`, `useBalance`, etc. — don't read from a context.
- Gate downstream queries on `isConnected` or `Boolean(address)`.

## Prefetching

For routes with predictable next-steps (dashboard → swap, etc.):

```ts
// use-page-prefetch / use-prefetch-dashboard patterns
const qc = useQueryClient()
qc.prefetchQuery({ queryKey: [...], queryFn: ... })
```

Prefetch on hover or on route-change intent — not on every render.

## Hooks that aren't data hooks

Utility hooks (`use-mobile`, `use-page-active`, `use-toast`) don't use TanStack Query. Keep them small, pure, and export a stable API.
