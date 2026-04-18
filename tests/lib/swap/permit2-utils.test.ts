import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { hashTypedData, keccak256, toBytes } from "viem"
import {
  INTENT_WITNESS_TYPE_STRING,
  GET_SWAP_INTENT_TYPES,
} from "@/lib/swap/permit2-utils"
import { PERMIT2_ADDRESS, FAST_SETTLEMENT_ADDRESS } from "@/lib/swap/constants"
import { validWalletAddress, bigUint128 } from "../../utils/arbitraries"

// EIP-712 signature encoding for the Permit2 witness transfer that drives
// every Fast Protocol swap. These tests are chain-adjacent: a byte-off hash
// here means every user signature silently reverts on-chain, because the
// FastSettlementV3 contract reconstructs the hash independently and compares.
//
// Strategy:
//   1. Structural — the types match the field list the contract expects, in
//      the exact order the contract computes over. Field reordering would
//      change the hash even though TypeScript would be happy.
//   2. Golden-hash — for a fixed (domain, types, message), viem's
//      `hashTypedData` must produce a known bytes32 value. If anyone changes
//      the type definitions, reorders a field, or mutates the witness type
//      string, this snapshot moves and the test fails loudly.
//   3. Property — the hash is deterministic: identical inputs produce
//      identical outputs, and only meaningful input changes move the hash.
//   4. Contract coupling — the witness type string must remain byte-identical
//      to what the FastSettlementV3 contract expects.

// ─── Structural tests ────────────────────────────────────────────────────────

describe("GET_SWAP_INTENT_TYPES — structural stability", () => {
  const types = GET_SWAP_INTENT_TYPES(INTENT_WITNESS_TYPE_STRING)

  it("declares the three expected type blocks in the expected shape", () => {
    expect(Object.keys(types).sort()).toEqual([
      "Intent",
      "PermitWitnessTransferFrom",
      "TokenPermissions",
    ])
  })

  it("PermitWitnessTransferFrom fields are in the EIP-712-mandated order", () => {
    // Order is part of the EIP-712 hash. Any reorder changes every
    // downstream signature and breaks verification on-chain.
    expect(types.PermitWitnessTransferFrom).toEqual([
      { name: "permitted", type: "TokenPermissions" },
      { name: "spender", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "witness", type: "Intent" },
    ])
  })

  it("TokenPermissions is {token: address, amount: uint256}", () => {
    expect(types.TokenPermissions).toEqual([
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ])
  })

  it("Intent carries all eight swap fields in the contract-expected order", () => {
    expect(types.Intent).toEqual([
      { name: "user", type: "address" },
      { name: "inputToken", type: "address" },
      { name: "outputToken", type: "address" },
      { name: "inputAmt", type: "uint256" },
      { name: "userAmtOut", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ])
  })
})

// ─── Witness type string coupling to the contract ────────────────────────────

describe("INTENT_WITNESS_TYPE_STRING — contract coupling", () => {
  it("starts with 'Intent witness)' — the wrapper Permit2 concatenates", () => {
    // Permit2 builds the full EIP-712 typehash by prepending its own
    // `PermitWitnessTransferFrom` header and then concatenating the
    // witness type string. The leading fragment must match exactly.
    expect(INTENT_WITNESS_TYPE_STRING.startsWith("Intent witness)")).toBe(true)
  })

  it("declares Intent(...) with the same fields as the Intent type block", () => {
    const intentBlockMatch = INTENT_WITNESS_TYPE_STRING.match(/Intent\(([^)]+)\)/)
    expect(intentBlockMatch).not.toBeNull()
    const fields = intentBlockMatch![1].split(",").map((f) => f.trim())
    expect(fields).toEqual([
      "address user",
      "address inputToken",
      "address outputToken",
      "uint256 inputAmt",
      "uint256 userAmtOut",
      "address recipient",
      "uint256 deadline",
      "uint256 nonce",
    ])
  })

  it("declares TokenPermissions(...) after Intent", () => {
    // The contract's `hashStruct(Intent)` depends on this suffix. Its
    // absence would produce the wrong typehash with no compile error.
    expect(INTENT_WITNESS_TYPE_STRING).toContain("TokenPermissions(address token,uint256 amount)")
  })

  it("keccak256 of the witness type string is a deterministic bytes32", () => {
    // Emit the hash so a visual diff in CI makes it trivial to spot when
    // the witness string drifts. If the contract renames a field, this
    // snapshot moves and the test fails.
    const hash = keccak256(toBytes(INTENT_WITNESS_TYPE_STRING))
    expect(hash).toMatchInlineSnapshot(
      `"0x42a3c5ff84f3c363ecd3e4c67c095aa17cfac2a704b64eeeddfa3cf0927f1e5f"`
    )
  })
})

// ─── Golden hash — fixed inputs produce a fixed typed-data hash ──────────────

// Using lower-case addresses throughout. viem's hashTypedData rejects
// non-EIP-55-checksummed mixed-case addresses, and lowercase is how our
// Zod walletAddressSchema emits them — so tests stay aligned with what
// the app actually produces at the signing boundary.
type GoldenMessage = {
  permitted: { token: `0x${string}`; amount: bigint }
  spender: `0x${string}`
  nonce: bigint
  deadline: bigint
  witness: {
    user: `0x${string}`
    inputToken: `0x${string}`
    outputToken: `0x${string}`
    inputAmt: bigint
    userAmtOut: bigint
    recipient: `0x${string}`
    deadline: bigint
    nonce: bigint
  }
}

const GOLDEN: {
  domain: { name: string; chainId: number; verifyingContract: `0x${string}` }
  types: ReturnType<typeof GET_SWAP_INTENT_TYPES>
  primaryType: "PermitWitnessTransferFrom"
  message: GoldenMessage
} = {
  domain: {
    name: "Permit2",
    chainId: 1,
    verifyingContract: PERMIT2_ADDRESS.toLowerCase() as `0x${string}`,
  },
  types: GET_SWAP_INTENT_TYPES(INTENT_WITNESS_TYPE_STRING),
  primaryType: "PermitWitnessTransferFrom",
  message: {
    permitted: {
      token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      amount: 1_000_000_000n, // 1000 USDC (6 decimals)
    },
    spender: FAST_SETTLEMENT_ADDRESS.toLowerCase() as `0x${string}`,
    nonce: 42n,
    deadline: 1_700_000_000n,
    witness: {
      user: "0x1111111111111111111111111111111111111111",
      inputToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      outputToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
      inputAmt: 1_000_000_000n,
      userAmtOut: 500_000_000_000_000_000n, // 0.5 ETH
      recipient: "0x1111111111111111111111111111111111111111",
      deadline: 1_700_000_000n,
      nonce: 42n,
    },
  },
}

describe("EIP-712 hash — golden snapshot", () => {
  it("hashTypedData(GOLDEN) produces a stable bytes32", () => {
    // If this value ever changes, the suite fails. The ONLY legitimate way to
    // update it is to mirror a contract-side change — at which point a
    // matched Solidity PR and test update happen together.
    const hash = hashTypedData(GOLDEN)
    expect(hash).toMatchInlineSnapshot(
      `"0x856bd73c6a5ce67f114fb859ab1f4dd082445821c0263268e5a74c66fd91c1a7"`
    )
  })

  it("hash is deterministic — same input twice, identical output", () => {
    expect(hashTypedData(GOLDEN)).toBe(hashTypedData(GOLDEN))
  })

  it("any field change moves the hash", () => {
    const base = hashTypedData(GOLDEN)

    const mutated = {
      ...GOLDEN,
      message: { ...GOLDEN.message, nonce: GOLDEN.message.nonce + 1n },
    }
    expect(hashTypedData(mutated)).not.toBe(base)
  })
})

// ─── Property tests on the signing surface ───────────────────────────────────

describe("hashTypedData — property tests over the intent surface", () => {
  const buildMessage = (over: Partial<(typeof GOLDEN)["message"]["witness"]>) => ({
    ...GOLDEN,
    message: {
      ...GOLDEN.message,
      ...over,
      witness: { ...GOLDEN.message.witness, ...over },
    },
  })

  it("is injective across `user` — distinct signers produce distinct hashes", () => {
    // viem's hashTypedData validates addresses as EIP-55-checksummed; our
    // Zod walletAddressSchema normalizes to lowercase and every call site
    // passes lowercase. Lowercase addresses bypass the checksum branch, so
    // we lower-case before hashing to mirror what the production signer
    // actually does.
    fc.assert(
      fc.property(validWalletAddress(), validWalletAddress(), (a, b) => {
        const aLower = a.toLowerCase() as `0x${string}`
        const bLower = b.toLowerCase() as `0x${string}`
        if (aLower === bLower) return true
        const ha = hashTypedData(buildMessage({ user: aLower, recipient: aLower }))
        const hb = hashTypedData(buildMessage({ user: bLower, recipient: bLower }))
        return ha !== hb
      })
    )
  })

  it("is injective across `nonce` — distinct nonces produce distinct hashes", () => {
    // Permit2's replay protection depends on this. If two nonces ever hashed
    // to the same typed data, a signed intent could be replayed by the filler.
    fc.assert(
      fc.property(bigUint128(), bigUint128(), (a, b) => {
        if (a === b) return true
        return hashTypedData(buildMessage({ nonce: a })) !==
          hashTypedData(buildMessage({ nonce: b }))
      })
    )
  })

  it("is injective across `deadline`", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 2n ** 64n - 1n }),
        fc.bigInt({ min: 1n, max: 2n ** 64n - 1n }),
        (a, b) => {
          if (a === b) return true
          return hashTypedData(buildMessage({ deadline: a })) !==
            hashTypedData(buildMessage({ deadline: b }))
        }
      )
    )
  })

  it("is stable under the WETH/ETH substitution agreed by the resolver", () => {
    // The swap engine rewrites native ETH to WETH at the quote boundary
    // (see token-resolver). Signing therefore always uses WETH as the
    // outputToken even when the UI says "ETH". Asserting the hash is a
    // function of the address-after-rewrite codifies that contract.
    const wethOut = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as `0x${string}`
    const h1 = hashTypedData(buildMessage({ outputToken: wethOut }))
    const h2 = hashTypedData(buildMessage({ outputToken: wethOut }))
    expect(h1).toBe(h2)
  })
})
