# Query keys

## Convention

Every TanStack Query key is an array starting with a domain-scoped string:

```ts
['swap', 'quote', { fromToken, toToken, amount, chainId }]
['dashboard', 'points', address]
['leaderboard', 'tier', 'gold', chainId]
['miles', 'estimated', address]
['tokens', 'balances', address, chainId]
['barter', 'supported-tokens']
['fuul', 'miles-leaderboard']
```

Rules:

1. **First element** = domain name, matching the hook filename prefix where possible.
2. **Second element** = sub-noun or verb.
3. **Remaining elements** = dependencies, in stable order.
4. Use **objects** only when you have 3+ related params; otherwise list them.
5. Never include functions, Dates (stringify to ISO), or non-stable refs.

## Invalidation patterns

```ts
// Invalidate a whole domain
qc.invalidateQueries({ queryKey: ['dashboard'] })

// Invalidate one specific query
qc.invalidateQueries({ queryKey: ['dashboard', 'points', address] })

// Predicate-based
qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'dashboard' })
```

## Shared key factory (recommended)

When a domain has many queries, define a factory:

```ts
// src/lib/query-keys.ts (add if/when needed)
export const dashboardKeys = {
  all: ['dashboard'] as const,
  points: (address: string) => ['dashboard', 'points', address] as const,
  swaps: (address: string) => ['dashboard', 'swaps', address] as const,
}
```

This prevents key drift across hooks. Do not create this pre-emptively — add it when you find yourself repeating keys in three+ places.

## When you break the convention

Rare, but if an external SDK (Fuul, Barter) returns data under its own key space and you want cache sharing, document the exception at the top of the hook file.
