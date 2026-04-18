import { describe, it, expect } from "vitest"
import {
  isWrapOperation,
  isUnwrapOperation,
  isWrapUnwrapPair,
} from "@/lib/tokens/weth-utils"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap/constants"
import type { Token } from "@/types/swap"

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
