# Typing patterns (viem + wagmi)

viem infers types from `as const` ABIs. Losing the const assertion breaks inference and falls back to `any`.

## Pattern: typed ABI

```ts
// src/lib/weth-abi.ts
export const WETH_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  // ...
] as const
```

`as const` is non-negotiable. Without it, `functionName` is `string` and args become `unknown[]`.

## Pattern: using with wagmi

```ts
import { WETH_ABI } from '@/lib/weth-abi'

const { writeContractAsync } = useWriteContract()
await writeContractAsync({
  abi: WETH_ABI,
  address: WETH_ADDRESS,
  functionName: 'deposit',   // autocompletes
  args: [],                   // typed from ABI
  value: parseEther('1'),     // payable methods
})
```

## Pattern: subset ABI

If you only need one method from a larger interface, inline the method in a const and use it — do not flatten the whole ABI:

```ts
const DEPOSIT_ABI = [
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
] as const
```

## Anti-patterns

- `abi: WETH_ABI as Abi` — throws away inference. Don't cast.
- Spreading ABIs (`[...ABI_A, ...ABI_B]`) inline — loses const-ness unless wrapped in a new `as const`.
- Using `ethers`'s `Contract` class for new code — prefer viem + wagmi. `ethers` is present only because some legacy paths use it.

## Multiple contract versions

`fast-settlement-v2-1.ts` and `fast-settlement-v3-abi.ts` are separate files on purpose — they have diverging method surfaces. `src/lib/contract-config.tsx` picks the version for the current deployment. Never merge them.
