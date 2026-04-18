# wagmi patterns

## Reading state

```ts
// Account
const { address, isConnected } = useAccount()

// Balance
const { data: balance } = useBalance({ address, chainId })

// Contract read
const { data } = useReadContract({
  abi: MY_ABI,
  address: MY_CONTRACT,
  functionName: 'foo',
  args: [someArg],
  query: { enabled: Boolean(address) },
})
```

- Always gate reads with `query: { enabled: ... }` when a dependency might be undefined. Without this, wagmi fires the read against zero-address / undefined and adds noise.

## Writing state

```ts
const { writeContractAsync } = useWriteContract()
const hash = await writeContractAsync({
  abi: MY_ABI,
  address: MY_CONTRACT,
  functionName: 'foo',
  args: [someArg],
})
// hand the hash to use-wait-for-tx-confirmation
```

- Prefer `writeContractAsync` over `writeContract` when you need the hash in-line (most swap/mint flows do).
- Wrap every error in `normalizeTxError` from `src/lib/transaction-errors.ts` before showing it to the user.

## Chain switching

```ts
const { switchChainAsync } = useSwitchChain()
await switchChainAsync({ chainId: TARGET_CHAIN })
```

Do not use `chain.id` from wagmi as a source of truth for *target* chain — always pass the desired chain ID from config (`src/lib/network-config.ts`).

## Custom RPC (Fast RPC)

See `use-rpc-setup.ts` and `use-rpc-test.ts` for the pattern. The user adds Fast RPC via the network-checker flow; the app then uses it as an optional transport via `src/lib/wagmi.ts`.

## viem escape hatch

For complex calls (batch read, simulate), drop to viem:

```ts
const publicClient = usePublicClient()
const result = await publicClient.simulateContract({ ... })
```

Use this sparingly — it's harder to test-mock and easy to bypass the wagmi cache.
