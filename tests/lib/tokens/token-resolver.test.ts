import { describe, it, expect } from "vitest"
import {
  resolveTokenAddress,
  resolveTokenDecimals,
  isNativeETH,
  getTokenSymbol,
} from "@/lib/tokens/token-resolver"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap/constants"
import type { Token } from "@/types/swap"

// These tests lock the ETH↔WETH substitution rule that drives Uniswap quoting.
// The quoter ABI only understands ERC-20 addresses, so native ETH (which uses
// the zero-address sentinel inside this codebase) must always be rewritten to
// WETH before being sent to the quoter. A regression here produces silent
// "no liquidity" errors in the UI, which the user sees as a broken swap.

const USDC: Token = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  decimals: 6,
  name: "USD Coin",
}

const ETH_TOKEN: Token = {
  address: ZERO_ADDRESS,
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
}

describe("resolveTokenAddress", () => {
  it("returns null for nullish input", () => {
    expect(resolveTokenAddress(null)).toBeNull()
    expect(resolveTokenAddress(undefined)).toBeNull()
  })

  it("returns the token's own address for a concrete ERC-20", () => {
    expect(resolveTokenAddress(USDC)).toBe(USDC.address)
  })

  it("rewrites native ETH (zero-address sentinel) to WETH", () => {
    // The zero-address token object represents native ETH in this codebase.
    // Quoter calls require WETH — this substitution is load-bearing.
    expect(resolveTokenAddress(ETH_TOKEN)).toBe(WETH_ADDRESS)
  })

  it("rewrites 'ETH' symbol to WETH even without token object", () => {
    expect(resolveTokenAddress("ETH")).toBe(WETH_ADDRESS)
    expect(resolveTokenAddress("eth")).toBe(WETH_ADDRESS)
  })

  it("rewrites a token whose symbol is ETH regardless of address", () => {
    // Defensive: if an ETH-labelled entry ever ships with a non-zero address,
    // we still route it through WETH rather than quoting against a phantom
    // ERC-20. This mirrors the guard inside resolveTokenAddress.
    const weirdEth: Token = { ...ETH_TOKEN, address: "0xdead" }
    expect(resolveTokenAddress(weirdEth)).toBe(WETH_ADDRESS)
  })

  it("looks up symbol in the provided token list", () => {
    expect(resolveTokenAddress("USDC", [USDC])).toBe(USDC.address)
  })

  it("returns null when the symbol is missing from the list", () => {
    expect(resolveTokenAddress("FOO", [USDC])).toBeNull()
  })
})

describe("resolveTokenDecimals", () => {
  it("defaults to 18 for nullish or missing entries", () => {
    // 18 is the ERC-20 default. Callers rely on this to keep the quoter
    // progressing instead of bailing — wrong decimals here would misprice
    // the trade, not crash it, so the test documents the intent.
    expect(resolveTokenDecimals(null)).toBe(18)
    expect(resolveTokenDecimals(undefined)).toBe(18)
    expect(resolveTokenDecimals("UNKNOWN")).toBe(18)
  })

  it("uses the token's own decimals field when present", () => {
    expect(resolveTokenDecimals(USDC)).toBe(6)
  })

  it("falls back to the list when given a symbol", () => {
    expect(resolveTokenDecimals("USDC", [USDC])).toBe(6)
  })
})

describe("isNativeETH", () => {
  it("is true for the zero-address ETH token", () => {
    expect(isNativeETH(ETH_TOKEN)).toBe(true)
  })

  it("is true for the literal 'ETH' symbol (case-insensitive)", () => {
    expect(isNativeETH("ETH")).toBe(true)
    expect(isNativeETH("eth")).toBe(true)
  })

  it("is false for any concrete ERC-20", () => {
    expect(isNativeETH(USDC)).toBe(false)
    expect(isNativeETH("USDC")).toBe(false)
  })
})

describe("getTokenSymbol", () => {
  it("returns the symbol for a token object, or null if absent", () => {
    expect(getTokenSymbol(USDC)).toBe("USDC")
    expect(getTokenSymbol(null)).toBeNull()
  })
})
