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

// ─── mutation-coverage kills ─────────────────────────────────────────────────
//
// These tests target the non-equivalent Stryker survivors in token-resolver.ts.
// They look unglamorous — mostly assertions on edge inputs — but each one
// kills a specific mutant that would otherwise survive. Adding a case here
// without a mutant target is fine; removing one without running Stryker is
// not. Run `npx stryker run` after editing.

describe("token-resolver — edge-shape kills", () => {
  it("resolveTokenAddress returns null for an object with no address field", () => {
    // Line 27 `typeof === "object" && token.address` — the `&&` guard
    // protects against object-without-address entering the branch. A `||`
    // mutant would enter the branch and, if symbol === "ETH", incorrectly
    // return WETH; we want null.
    expect(resolveTokenAddress({ symbol: "ETH" } as unknown as Token)).toBeNull()
    expect(resolveTokenAddress({ symbol: "USDC" } as unknown as Token)).toBeNull()
  })

  it("resolveTokenAddress handles token objects with missing symbol without crashing", () => {
    // Line 29 `token.symbol?.toUpperCase()` — the optional chain is what
    // prevents a TypeError when symbol is undefined. If someone removes
    // the `?.`, this case will throw; the assertion is "doesn't throw
    // AND returns the object's own address".
    expect(resolveTokenAddress({ address: "0xabcd" } as unknown as Token)).toBe("0xabcd")
  })

  it("resolveTokenAddress routes a ZERO_ADDRESS entry from the list to WETH", () => {
    // Line 49 `if (foundToken.address === ZERO_ADDRESS)` — pinning both
    // sides: when the list entry IS the zero-address, we substitute WETH.
    // When it isn't, we return the entry's own address verbatim.
    const zeroEntry: Token = {
      address: ZERO_ADDRESS,
      symbol: "ETHISH",
      decimals: 18,
      name: "Zero",
    }
    expect(resolveTokenAddress("ETHISH", [zeroEntry])).toBe(WETH_ADDRESS)
    expect(resolveTokenAddress("USDC", [USDC])).toBe(USDC.address)
  })

  it("resolveTokenAddress picks the matching symbol out of a crowded list", () => {
    // Line 83 `.find((t) => t.symbol.toUpperCase() === symbol)` — a
    // mutant that replaces the predicate with `() => true` returns the
    // first element regardless of symbol. This test fails that mutant
    // because the lookup has to find USDC (third), not DAI (first).
    const DAI: Token = {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      symbol: "DAI",
      decimals: 18,
      name: "Dai",
    }
    const WBTC: Token = {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      symbol: "WBTC",
      decimals: 8,
      name: "Wrapped Bitcoin",
    }
    expect(resolveTokenAddress("USDC", [DAI, WBTC, USDC])).toBe(USDC.address)
  })

  it("resolveTokenAddress returns null for non-string / non-object inputs", () => {
    // Line 36 `typeof token === "string"` — a mutant flipping this to
    // `true` would try to enter the string branch with a number or
    // boolean and crash on .toUpperCase(). The `!token` guard at line 24
    // catches primitive falsy values, but 1 and true are truthy.
    expect(resolveTokenAddress(1 as unknown as Token)).toBeNull()
    expect(resolveTokenAddress(true as unknown as Token)).toBeNull()
  })

  it("resolveTokenDecimals falls back to 18 for objects without a number `decimals`", () => {
    // Line 76 `typeof token === "object" && typeof token.decimals === "number"`
    // — a mutant flipping the second conjunct to `true` would read
    // `token.decimals` (undefined or a non-number string) instead of
    // defaulting. We expect 18.
    expect(resolveTokenDecimals({ address: "0xabc", symbol: "X" } as unknown as Token)).toBe(18)
    expect(
      resolveTokenDecimals({
        address: "0xabc",
        symbol: "X",
        decimals: "6" as unknown as number,
      } as Token)
    ).toBe(18)
  })

  it("resolveTokenDecimals picks the matching symbol out of a crowded list", () => {
    // Line 83 `.find((t) => t.symbol.toUpperCase() === symbol)` —
    // mirror of the resolveTokenAddress test, but on the decimals
    // function. A mutant replacing the predicate with `() => true`
    // would return the first entry (DAI, decimals=18) instead of the
    // matching USDC (decimals=6), so the assertion catches it.
    const DAI_DEC: Token = {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      symbol: "DAI",
      decimals: 18,
      name: "Dai",
    }
    const WBTC_DEC: Token = {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      symbol: "WBTC",
      decimals: 8,
      name: "Wrapped Bitcoin",
    }
    expect(resolveTokenDecimals("USDC", [DAI_DEC, WBTC_DEC, USDC])).toBe(6)
    // And a non-18 confirmation so the mutant can't squeak by on a
    // match where first-element decimals happened to equal the answer.
    expect(resolveTokenDecimals("WBTC", [DAI_DEC, USDC, WBTC_DEC])).toBe(8)
  })

  it("resolveTokenDecimals honors list lookups only when decimals is a number", () => {
    // Line 85 `foundToken && typeof foundToken.decimals === "number"`
    // — if a list entry has a non-number decimals, we default to 18
    // instead of returning garbage. Protects against upstream token-list
    // drift (e.g. a schema that accidentally stringifies decimals).
    const broken: Token = {
      address: "0x1",
      symbol: "BROKEN",
      decimals: "18" as unknown as number,
      name: "Broken",
    }
    expect(resolveTokenDecimals("BROKEN", [broken])).toBe(18)
  })

  it("isNativeETH returns false for a concrete ERC-20 with non-ETH symbol and non-zero address", () => {
    // Line 101 `||` — a mutant flipping to `&&` would require BOTH the
    // zero-address AND symbol="ETH" to be true before returning true,
    // which breaks the common case. Pinning: a USDC-like token (neither
    // zero-address nor ETH symbol) is false; a zero-address token with
    // USDC-looking symbol is TRUE (address matches); an ETH-symbol
    // token with non-zero address is TRUE (symbol matches).
    expect(isNativeETH({ address: "0xabc", symbol: "USDC" } as Token)).toBe(false)
    expect(isNativeETH({ address: ZERO_ADDRESS, symbol: "USDC" } as Token)).toBe(true)
    expect(isNativeETH({ address: "0xabc", symbol: "eth" } as Token)).toBe(true)
  })

  it("isNativeETH does not crash on an object with missing symbol", () => {
    // Line 101 `symbol?.toUpperCase()` — the optional chain prevents a
    // TypeError when symbol is undefined. A mutant removing `?.` would
    // throw here.
    expect(isNativeETH({ address: "0xabc" } as unknown as Token)).toBe(false)
  })

  it("isNativeETH returns false for non-string / non-object / null inputs", () => {
    // Line 98 `return false` — a boolean-flip mutant would return true
    // for nullish. Lines 104 and 117 `typeof === "string"` flipped to
    // `true` would misclassify numbers/booleans.
    expect(isNativeETH(null)).toBe(false)
    expect(isNativeETH(undefined)).toBe(false)
    expect(isNativeETH(42 as unknown as Token)).toBe(false)
    expect(isNativeETH(false as unknown as Token)).toBe(false)
  })

  it("getTokenSymbol returns null for primitive non-string inputs", () => {
    // Line 117 `typeof === "object"` — a mutant flipping to `true` would
    // treat a number as an object and try to read `.symbol`. Kill case.
    expect(getTokenSymbol(42 as unknown as Token)).toBeNull()
    expect(getTokenSymbol(true as unknown as Token)).toBeNull()
  })

  it("getTokenSymbol returns the bare string when given a string input", () => {
    expect(getTokenSymbol("USDC")).toBe("USDC")
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
