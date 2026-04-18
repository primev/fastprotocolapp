import { describe, it, expect } from "vitest"
import {
  walletAddressSchema,
  txHashSchema,
  tokenSymbolSchema,
  paginationSchema,
} from "@/lib/api/schemas"

// These schemas are consumed by ~15 API routes. A regression here becomes a
// 400-on-every-request incident, so we pin the exact accept/reject + transform
// behavior to avoid silent drift.

describe("walletAddressSchema", () => {
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
})

describe("txHashSchema", () => {
  it("accepts a 32-byte hex hash and lower-cases it", () => {
    const raw = "0x" + "ABCDEF12".repeat(8)
    const out = txHashSchema.parse(raw)
    expect(out).toBe(raw.toLowerCase())
  })

  it("rejects 20-byte (address-length) hex", () => {
    // A wallet address must NOT be accepted as a tx hash — this is the exact
    // kind of mix-up the schema is here to prevent.
    expect(() => txHashSchema.parse("0xabcdef1234567890abcdef1234567890abcdef12")).toThrow()
  })
})

describe("tokenSymbolSchema", () => {
  it("uppercases and caps length", () => {
    expect(tokenSymbolSchema.parse("usdc")).toBe("USDC")
    expect(tokenSymbolSchema.parse("eth")).toBe("ETH")
  })

  it("rejects empty and overlong symbols", () => {
    expect(() => tokenSymbolSchema.parse("")).toThrow()
    expect(() => tokenSymbolSchema.parse("A".repeat(17))).toThrow()
  })
})

describe("paginationSchema", () => {
  it("defaults offset=0, limit=50 when nothing is provided", () => {
    expect(paginationSchema.parse({})).toEqual({ offset: 0, limit: 50 })
  })

  it("coerces string query params into numbers", () => {
    expect(paginationSchema.parse({ offset: "10", limit: "25" })).toEqual({ offset: 10, limit: 25 })
  })

  it("rejects negative offsets and oversized limits", () => {
    // limit is capped at 200 to prevent a caller from asking for arbitrarily
    // large slabs of data; offset has a million-row ceiling for similar reasons.
    expect(() => paginationSchema.parse({ limit: "500" })).toThrow()
    expect(() => paginationSchema.parse({ offset: "-1" })).toThrow()
  })
})
