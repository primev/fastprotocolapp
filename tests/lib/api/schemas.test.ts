import { describe, it, expect } from "vitest"
import fc from "fast-check"
import {
  walletAddressSchema,
  txHashSchema,
  tokenSymbolSchema,
  paginationSchema,
} from "@/lib/api/schemas"
import {
  validWalletAddress,
  invalidWalletAddress,
  validTxHash,
  validTokenSymbol,
  invalidTokenSymbol,
} from "../../utils/arbitraries"

// These schemas are consumed by ~24 API routes. A regression here becomes a
// 400-on-every-request incident. Unit tests pin the golden examples; the
// property tests below assert the whole accept/reject frontier.
//
// Each schema is tested in two voices:
//   - example-based tests pin specific inputs the team has reasoned about
//   - property-based tests (fast-check) generate thousands of random inputs
//     and assert the schema's invariants hold across the entire input space

// ─── walletAddressSchema ─────────────────────────────────────────────────────

describe("walletAddressSchema — examples", () => {
  it("accepts a valid address and lower-cases it", () => {
    const out = walletAddressSchema.parse("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")
    expect(out).toBe("0xabcdef1234567890abcdef1234567890abcdef12")
  })

  it("rejects wrong length, missing prefix, and non-hex chars", () => {
    expect(() => walletAddressSchema.parse("0xabc")).toThrow()
    expect(() => walletAddressSchema.parse("abcdef1234567890abcdef1234567890abcdef12")).toThrow()
    expect(() => walletAddressSchema.parse("0xZZZZEF1234567890ABCDEF1234567890ABCDEF12")).toThrow()
  })

  it("rejects non-strings", () => {
    expect(() => walletAddressSchema.parse(undefined)).toThrow()
    expect(() => walletAddressSchema.parse(123)).toThrow()
  })

  it("anchors — rejects valid-prefix + junk suffix (guards the trailing $)", () => {
    // If the regex lost its `$` anchor, this 42-char valid prefix followed by
    // a spurious suffix would pass validation and feed a malformed address
    // into downstream SQL. The length/hex regex alone is not enough.
    expect(() =>
      walletAddressSchema.parse("0xabcdef1234567890abcdef1234567890abcdef12_junk")
    ).toThrow()
  })

  it("anchors — rejects junk prefix + valid-length suffix (guards the leading ^)", () => {
    // If the regex lost its `^` anchor, a 42-char valid tail would smuggle
    // a caller-controlled prefix through.
    expect(() =>
      walletAddressSchema.parse("junk_0xabcdef1234567890abcdef1234567890abcdef12")
    ).toThrow()
  })

  it("error message surfaces 'Invalid wallet address' verbatim", () => {
    // 400 responses include the message — UI + ops dashboards read it.
    // Pin the exact string so a typo doesn't silently break downstream
    // consumers that match on it.
    const result = walletAddressSchema.safeParse("not-an-address")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe("Invalid wallet address")
    }
  })
})

describe("walletAddressSchema — properties", () => {
  it("accepts every valid address and emits lowercase", () => {
    fc.assert(
      fc.property(validWalletAddress(), (addr) => {
        const out = walletAddressSchema.parse(addr)
        return out === addr.toLowerCase()
      })
    )
  })

  it("is idempotent — parse(parse(x)) === parse(x)", () => {
    // Load-bearing: cache keys and SQL rows use the parsed output. If parsing
    // an already-parsed address ever drifted, downstream comparisons would
    // silently miss matches.
    fc.assert(
      fc.property(validWalletAddress(), (addr) => {
        const once = walletAddressSchema.parse(addr)
        const twice = walletAddressSchema.parse(once)
        return once === twice
      })
    )
  })

  it("always produces a 42-char string starting with '0x' and only lowercase hex", () => {
    fc.assert(
      fc.property(validWalletAddress(), (addr) => {
        const out = walletAddressSchema.parse(addr)
        return out.length === 42 && /^0x[0-9a-f]{40}$/.test(out)
      })
    )
  })

  it("rejects every invalid shape", () => {
    fc.assert(
      fc.property(invalidWalletAddress(), (bad) => {
        const result = walletAddressSchema.safeParse(bad)
        return !result.success
      })
    )
  })

  it("rejects non-string inputs regardless of value", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.float(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        (notAString) => !walletAddressSchema.safeParse(notAString).success
      )
    )
  })
})

// ─── txHashSchema ────────────────────────────────────────────────────────────

describe("txHashSchema — examples", () => {
  it("accepts a 32-byte hex hash and lower-cases it", () => {
    const raw = "0x" + "ABCDEF12".repeat(8)
    const out = txHashSchema.parse(raw)
    expect(out).toBe(raw.toLowerCase())
  })

  it("rejects 20-byte (address-length) hex", () => {
    // A wallet address must NOT be accepted as a tx hash — this is exactly
    // the mix-up the schema prevents.
    expect(() => txHashSchema.parse("0xabcdef1234567890abcdef1234567890abcdef12")).toThrow()
  })

  it("anchors — rejects valid-prefix + junk suffix (guards the trailing $)", () => {
    // Same concern as the wallet anchor test — a 66-char valid prefix + junk
    // must not slip through. DB rows are indexed on the hash value; a
    // malformed key would silently split related events across two rows.
    const raw = "0x" + "abcdef12".repeat(8) + "_junk"
    expect(() => txHashSchema.parse(raw)).toThrow()
  })

  it("anchors — rejects junk prefix + valid-length suffix (guards the leading ^)", () => {
    const raw = "junk_0x" + "abcdef12".repeat(8)
    expect(() => txHashSchema.parse(raw)).toThrow()
  })

  it("error message surfaces 'Invalid transaction hash' verbatim", () => {
    const result = txHashSchema.safeParse("not-a-hash")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe("Invalid transaction hash")
    }
  })
})

describe("txHashSchema — properties", () => {
  it("accepts every valid 32-byte hex and emits lowercase", () => {
    fc.assert(
      fc.property(validTxHash(), (hash) => {
        const out = txHashSchema.parse(hash)
        return out === hash.toLowerCase() && out.length === 66
      })
    )
  })

  it("is idempotent — parse(parse(x)) === parse(x)", () => {
    fc.assert(
      fc.property(validTxHash(), (hash) => {
        const once = txHashSchema.parse(hash)
        return txHashSchema.parse(once) === once
      })
    )
  })

  it("rejects every valid wallet address", () => {
    // Wallet and hash share the 0x-hex shape but differ on length; a
    // hash schema must not accept any well-formed wallet address.
    fc.assert(
      fc.property(validWalletAddress(), (addr) => !txHashSchema.safeParse(addr).success)
    )
  })
})

// ─── tokenSymbolSchema ───────────────────────────────────────────────────────

describe("tokenSymbolSchema — examples", () => {
  it("uppercases and caps length", () => {
    expect(tokenSymbolSchema.parse("usdc")).toBe("USDC")
    expect(tokenSymbolSchema.parse("eth")).toBe("ETH")
  })

  it("rejects empty and overlong symbols", () => {
    expect(() => tokenSymbolSchema.parse("")).toThrow()
    expect(() => tokenSymbolSchema.parse("A".repeat(17))).toThrow()
  })

  it("error messages surface 'Symbol is required' / 'Symbol too long' verbatim", () => {
    const tooShort = tokenSymbolSchema.safeParse("")
    expect(tooShort.success).toBe(false)
    if (!tooShort.success) {
      expect(tooShort.error.issues[0]!.message).toBe("Symbol is required")
    }
    const tooLong = tokenSymbolSchema.safeParse("A".repeat(17))
    expect(tooLong.success).toBe(false)
    if (!tooLong.success) {
      expect(tooLong.error.issues[0]!.message).toBe("Symbol too long")
    }
  })
})

describe("tokenSymbolSchema — properties", () => {
  it("accepts 1–16 char strings and upper-cases them", () => {
    fc.assert(
      fc.property(validTokenSymbol(), (sym) => {
        const out = tokenSymbolSchema.parse(sym)
        return out === sym.toUpperCase() && out.length === sym.length
      })
    )
  })

  it("is idempotent under re-parsing", () => {
    fc.assert(
      fc.property(validTokenSymbol(), (sym) => {
        const once = tokenSymbolSchema.parse(sym)
        return tokenSymbolSchema.parse(once) === once
      })
    )
  })

  it("rejects empty and overlong inputs across the input space", () => {
    fc.assert(
      fc.property(invalidTokenSymbol(), (bad) => !tokenSymbolSchema.safeParse(bad).success)
    )
  })
})

// ─── paginationSchema ────────────────────────────────────────────────────────

describe("paginationSchema — examples", () => {
  it("defaults offset=0, limit=50 when nothing is provided", () => {
    expect(paginationSchema.parse({})).toEqual({ offset: 0, limit: 50 })
  })

  it("coerces string query params into numbers", () => {
    expect(paginationSchema.parse({ offset: "10", limit: "25" })).toEqual({ offset: 10, limit: 25 })
  })

  it("rejects negative offsets and oversized limits", () => {
    expect(() => paginationSchema.parse({ limit: "500" })).toThrow()
    expect(() => paginationSchema.parse({ offset: "-1" })).toThrow()
  })
})

describe("paginationSchema — properties", () => {
  it("accepts any in-range offset/limit — either as numbers or strings", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 200 }),
        fc.boolean(),
        (offset, limit, useStrings) => {
          const input = useStrings
            ? { offset: String(offset), limit: String(limit) }
            : { offset, limit }
          const out = paginationSchema.parse(input)
          return out.offset === offset && out.limit === limit
        }
      )
    )
  })

  it("output is always within documented bounds", () => {
    // Even after defaults + coercion, offset ∈ [0, 1_000_000] and
    // limit ∈ [1, 200]. Callers depend on these bounds to size SQL slices
    // safely — a drift here is a direct DoS vector.
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 1_000_000 })),
        fc.option(fc.integer({ min: 1, max: 200 })),
        (offset, limit) => {
          const input: Record<string, unknown> = {}
          if (offset !== null) input.offset = offset
          if (limit !== null) input.limit = limit
          const out = paginationSchema.parse(input)
          return (
            Number.isInteger(out.offset) &&
            out.offset >= 0 &&
            out.offset <= 1_000_000 &&
            Number.isInteger(out.limit) &&
            out.limit >= 1 &&
            out.limit <= 200
          )
        }
      )
    )
  })

  it("rejects out-of-range values regardless of how they arrive", () => {
    const tooLarge = fc.integer({ min: 201, max: 10_000 })
    const negative = fc.integer({ min: -1000, max: -1 })
    fc.assert(
      fc.property(tooLarge, (n) => !paginationSchema.safeParse({ limit: n }).success)
    )
    fc.assert(
      fc.property(negative, (n) => !paginationSchema.safeParse({ offset: n }).success)
    )
  })
})
