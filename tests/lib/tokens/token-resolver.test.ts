import { describe, it, expect } from "vitest"
import fc from "fast-check"
import {
  resolveTokenAddress,
  resolveTokenDecimals,
  isNativeETH,
  getTokenSymbol,
} from "@/lib/tokens/token-resolver"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap/constants"
import type { Token } from "@/types/swap"
import { validWalletAddress } from "../../utils/arbitraries"

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

// ─── properties ──────────────────────────────────────────────────────────────
//
// These lock the two load-bearing invariants of the resolver:
//   1. Totality — no call path throws on any combination of inputs.
//   2. The ETH-like → WETH substitution is exhaustive: whether the caller
//      passes a Token with zero-address, a Token with symbol="ETH", or the
//      bare string "ETH", the resolver emits WETH_ADDRESS. The Uniswap
//      quoter cannot accept native ETH, so any leak of the zero address
//      would produce silent "no liquidity" errors.

function erc20TokenArb(): fc.Arbitrary<Token> {
  return fc
    .record({
      address: validWalletAddress(),
      symbol: fc.string({ minLength: 1, maxLength: 8 }),
      decimals: fc.integer({ min: 0, max: 32 }),
    })
    .filter(
      (t) => t.address !== ZERO_ADDRESS && t.symbol.toUpperCase() !== "ETH"
    )
    .map((t) => ({ ...t, name: t.symbol }) as Token)
}

describe("token-resolver — invariants", () => {
  it("resolveTokenAddress is total (no throw for any token-shaped input)", () => {
    fc.assert(
      fc.property(fc.option(erc20TokenArb()), (token) => {
        resolveTokenAddress(token ?? undefined)
        return true
      })
    )
    fc.assert(
      fc.property(fc.option(fc.string()), (sym) => {
        resolveTokenAddress(sym ?? undefined)
        return true
      })
    )
  })

  it("any ETH-like input resolves to WETH_ADDRESS", () => {
    // Three ways a caller expresses "native ETH":
    //   - token object with zero address
    //   - token object with symbol "ETH" (any case)
    //   - bare string "ETH" (any case)
    // All three must rewrite to WETH — otherwise the quoter gets garbage.
    const ethish = fc.oneof(
      fc.record({ address: fc.constant(ZERO_ADDRESS), symbol: fc.constant("ANY") }),
      fc.record({
        address: validWalletAddress(),
        symbol: fc.constantFrom("ETH", "eth", "Eth"),
      }),
      fc.record({ address: fc.constant(ZERO_ADDRESS), symbol: fc.constant("ETH") })
    )
    fc.assert(
      fc.property(ethish, (raw) => {
        const token: Token = { ...raw, decimals: 18, name: "Ether" }
        return resolveTokenAddress(token) === WETH_ADDRESS
      })
    )
    fc.assert(
      fc.property(fc.constantFrom("ETH", "eth", "Eth", "ETh"), (sym) => {
        return resolveTokenAddress(sym) === WETH_ADDRESS
      })
    )
  })

  it("resolveTokenDecimals is total and defaults to 18 for nullish/missing inputs", () => {
    fc.assert(
      fc.property(fc.option(fc.string()), (sym) => {
        const out = resolveTokenDecimals(sym ?? undefined)
        return Number.isInteger(out) && out >= 0
      })
    )
  })

  it("isNativeETH is total and returns a boolean", () => {
    fc.assert(
      fc.property(fc.option(erc20TokenArb()), (token) => {
        const out = isNativeETH(token ?? undefined)
        return typeof out === "boolean"
      })
    )
  })

  it("isNativeETH(ETH-like) is always true", () => {
    fc.assert(
      fc.property(fc.constantFrom("ETH", "eth", "ETh"), (sym) => {
        return isNativeETH(sym) === true
      })
    )
  })

  it("isNativeETH(real ERC-20) is always false", () => {
    fc.assert(
      fc.property(erc20TokenArb(), (token) => {
        return isNativeETH(token) === false
      })
    )
  })
})
