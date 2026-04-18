import { describe, it, expect } from "vitest"
import fc from "fast-check"
import {
  isWrapOperation,
  isUnwrapOperation,
  isWrapUnwrapPair,
} from "@/lib/tokens/weth-utils"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap/constants"
import type { Token } from "@/types/swap"
import { validWalletAddress } from "../../utils/arbitraries"

// Why this exists: the swap engine short-circuits ETH↔WETH pairs out of the
// Uniswap quoter and into direct deposit/withdraw calls on the WETH contract.
// If the detectors miss a pair, users pay Uniswap routing fees for a 1:1
// conversion. If they false-positive, the quoter gets bypassed for real trades.
// Both failure modes are silent, so we lock the detection rules here.

const ETH: Token = {
  address: ZERO_ADDRESS,
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
}

const WETH: Token = {
  address: WETH_ADDRESS,
  symbol: "WETH",
  decimals: 18,
  name: "Wrapped Ether",
}

const USDC: Token = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  decimals: 6,
  name: "USD Coin",
}

describe("isWrapOperation", () => {
  it("is true for ETH → WETH", () => {
    expect(isWrapOperation(ETH, WETH)).toBe(true)
  })

  it("tolerates mixed-case WETH address", () => {
    const weirdWeth: Token = { ...WETH, address: WETH_ADDRESS.toUpperCase() }
    expect(isWrapOperation(ETH, weirdWeth)).toBe(true)
  })

  it("is false when fromToken is not ETH", () => {
    expect(isWrapOperation(WETH, WETH)).toBe(false)
    expect(isWrapOperation(USDC, WETH)).toBe(false)
  })

  it("is false when toToken is not WETH", () => {
    expect(isWrapOperation(ETH, USDC)).toBe(false)
  })

  it("is false when either side is undefined", () => {
    expect(isWrapOperation(undefined, WETH)).toBe(false)
    expect(isWrapOperation(ETH, undefined)).toBe(false)
  })
})

describe("isUnwrapOperation", () => {
  it("is true for WETH → ETH", () => {
    expect(isUnwrapOperation(WETH, ETH)).toBe(true)
  })

  it("is false for any other pair", () => {
    expect(isUnwrapOperation(ETH, WETH)).toBe(false)
    expect(isUnwrapOperation(USDC, ETH)).toBe(false)
    expect(isUnwrapOperation(WETH, USDC)).toBe(false)
  })
})

describe("isWrapUnwrapPair", () => {
  it("matches either direction", () => {
    expect(isWrapUnwrapPair(ETH, WETH)).toBe(true)
    expect(isWrapUnwrapPair(WETH, ETH)).toBe(true)
  })

  it("does not match a genuine swap", () => {
    expect(isWrapUnwrapPair(USDC, WETH)).toBe(false)
  })
})

// ─── properties ──────────────────────────────────────────────────────────────
//
// These lock the two load-bearing invariants of the detectors:
//   1. `isWrapUnwrapPair` is exactly the disjunction of the two directions.
//   2. A pair cannot simultaneously be "wrap" and "unwrap" — directionality
//      is a function of which side is ETH and which side is WETH.
//
// Breaking either would let a wrap/unwrap operation fall through to the
// Uniswap quoter (wasting a round trip and showing a misleading quote),
// or make a real swap get routed to the WETH contract's deposit/withdraw.

function tokenArb(): fc.Arbitrary<Token> {
  return fc.oneof(
    fc.constant(ETH),
    fc.constant(WETH),
    fc.constant(USDC),
    // Random ERC-20 — any address, any non-ETH/WETH symbol.
    fc
      .record({ address: validWalletAddress(), symbol: fc.string({ minLength: 1, maxLength: 8 }) })
      .filter(
        (t) =>
          t.address.toLowerCase() !== WETH_ADDRESS.toLowerCase() &&
          t.address !== ZERO_ADDRESS &&
          t.symbol.toUpperCase() !== "ETH" &&
          t.symbol.toUpperCase() !== "WETH"
      )
      .map((t) => ({ ...t, decimals: 18, name: t.symbol }) as Token)
  )
}

describe("weth-utils — invariants across token pairs", () => {
  it("isWrapUnwrapPair is the disjunction of the two directions", () => {
    fc.assert(
      fc.property(tokenArb(), tokenArb(), (from, to) => {
        const combined = isWrapUnwrapPair(from, to)
        const disjunction = isWrapOperation(from, to) || isUnwrapOperation(from, to)
        return combined === disjunction
      })
    )
  })

  it("a single pair is never simultaneously wrap AND unwrap", () => {
    // The two detectors partition the "wrap/unwrap" space by direction;
    // they must be mutually exclusive for any given ordered pair.
    fc.assert(
      fc.property(tokenArb(), tokenArb(), (from, to) => {
        return !(isWrapOperation(from, to) && isUnwrapOperation(from, to))
      })
    )
  })

  it("undefined inputs short-circuit to false in all shapes", () => {
    fc.assert(
      fc.property(fc.option(tokenArb()), fc.option(tokenArb()), (a, b) => {
        if (a !== null && b !== null) return true // skip — both defined
        const fa = a ?? undefined
        const fb = b ?? undefined
        return (
          isWrapOperation(fa, fb) === false &&
          isUnwrapOperation(fa, fb) === false &&
          isWrapUnwrapPair(fa, fb) === false
        )
      })
    )
  })

  it("swapping the arguments of wrap yields unwrap (and vice versa) for true ETH/WETH pairs", () => {
    // If (a, b) is wrap, (b, a) must be unwrap. This is what makes the
    // wrap/unwrap UX symmetric in the swap form's "invert" button.
    fc.assert(
      fc.property(fc.constantFrom(ETH, WETH), fc.constantFrom(ETH, WETH), (a, b) => {
        if (!isWrapOperation(a, b)) return true // only assert the direction
        return isUnwrapOperation(b, a) === true
      })
    )
  })
})
