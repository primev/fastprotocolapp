import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { NextRequest } from "next/server"
import { isAddress, type Address } from "viem"

import {
  walletAddressSchema,
  txHashSchema,
  tokenSymbolSchema,
  paginationSchema,
} from "@/lib/api/schemas"
import { parseJson, parseSearchParams } from "@/lib/api/parse"
import { isWrapUnwrapPair } from "@/lib/tokens/weth-utils"
import { resolveTokenAddress } from "@/lib/tokens/token-resolver"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap/constants"
import { buildPageNumbers } from "@/components/dashboard/leaderboard/paginate"
import type { Token } from "@/types/swap"
import {
  validWalletAddress,
  validTxHash,
  invalidWalletAddress,
} from "../utils/arbitraries"
import { z } from "zod"

// Cross-module invariants.
//
// These tests assert properties that span multiple modules — the kind of
// "always-true" rules that individual unit tests can't express because they
// describe the RELATIONSHIP between layers, not the behavior of one function.
//
// When one of these fails, the bug is almost always a silent coupling break:
// one module updated, the other didn't, and no single test covered the seam.
// Property-based assertions close that gap by sampling the entire input space
// across the boundary.

// ─── Schema coherence: every primitive is round-trip idempotent ──────────────

describe("every Zod primitive — parse(parse(x)) === parse(x)", () => {
  it("holds for walletAddressSchema × validWalletAddress()", () => {
    fc.assert(
      fc.property(validWalletAddress(), (addr) => {
        const once = walletAddressSchema.parse(addr)
        return walletAddressSchema.parse(once) === once
      })
    )
  })

  it("holds for txHashSchema × validTxHash()", () => {
    fc.assert(
      fc.property(validTxHash(), (h) => {
        const once = txHashSchema.parse(h)
        return txHashSchema.parse(once) === once
      })
    )
  })

  it("holds for tokenSymbolSchema on any 1–16 char symbol", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 16 }), (s) => {
        const once = tokenSymbolSchema.parse(s)
        return tokenSymbolSchema.parse(once) === once
      })
    )
  })

  it("holds for paginationSchema on valid numeric inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 200 }),
        (offset, limit) => {
          const once = paginationSchema.parse({ offset, limit })
          const twice = paginationSchema.parse(once)
          return once.offset === twice.offset && once.limit === twice.limit
        }
      )
    )
  })
})

// ─── Parse helpers: failures always carry a structured `issues[]` ────────────

describe("parse helpers — rejected inputs always return 400 with structured issues", () => {
  it("parseJson failure → 400 + `issues` array + populated `path`", async () => {
    const bodySchema = z.object({ foo: z.string().min(1) })
    await fc.assert(
      fc.asyncProperty(fc.record({ notFoo: fc.string() }), async (body) => {
        const req = new NextRequest("http://localhost/", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        })
        const result = await parseJson(req, bodySchema)
        expect(result.ok).toBe(false)
        if (result.ok) return false

        expect(result.response.status).toBe(400)
        const json = await result.response.json()
        return (
          json.error === "Invalid request" &&
          Array.isArray(json.issues) &&
          json.issues.length > 0 &&
          typeof json.issues[0].path === "string" &&
          typeof json.issues[0].message === "string"
        )
      })
    )
  })

  it("parseSearchParams failure on an invalid wallet → 400 with path=address", async () => {
    const querySchema = z.object({ address: walletAddressSchema })
    await fc.assert(
      fc.asyncProperty(invalidWalletAddress(), async (addr) => {
        const req = new NextRequest(`http://localhost/?address=${encodeURIComponent(addr)}`)
        const result = parseSearchParams(req, querySchema)
        if (result.ok) return false
        const json = await result.response.json()
        return (
          json.error === "Invalid request" &&
          Array.isArray(json.issues) &&
          json.issues.some((i: { path: string }) => i.path === "address")
        )
      })
    )
  })
})

// ─── Wallet schema ↔ viem: the parsed output is always a valid Address ───────

describe("walletAddressSchema × viem.isAddress", () => {
  it("every parsed wallet address passes viem's isAddress check", () => {
    // Load-bearing: downstream callers often cast the parsed string to viem's
    // `Address` branded type. If the schema ever emitted something viem
    // rejected, those casts would silently lie and produce runtime errors
    // deeper in the call stack.
    fc.assert(
      fc.property(validWalletAddress(), (addr) => {
        const parsed: Address = walletAddressSchema.parse(addr) as Address
        return isAddress(parsed)
      })
    )
  })
})

// ─── Swap engine: wrap/unwrap detection ↔ quoter bypass ──────────────────────

describe("wrap/unwrap ↔ token-resolver coherence", () => {
  const ETH: Token = { address: ZERO_ADDRESS, symbol: "ETH", decimals: 18, name: "Ether" }
  const WETH: Token = {
    address: WETH_ADDRESS,
    symbol: "WETH",
    decimals: 18,
    name: "Wrapped Ether",
  }

  it("an ETH/WETH pair — regardless of direction — resolves BOTH sides to WETH_ADDRESS", () => {
    // This is the invariant that makes wrap/unwrap safe to handle without
    // hitting the quoter: if both resolvers produce WETH_ADDRESS, then a
    // `swap` call against the quoter would be comparing WETH to WETH — a
    // degenerate 1:1 pool lookup. The quoter-bypass short-circuit is only
    // correct because this property holds.
    for (const [from, to] of [
      [ETH, WETH],
      [WETH, ETH],
    ] as const) {
      expect(isWrapUnwrapPair(from, to)).toBe(true)
      expect(resolveTokenAddress(from)).toBe(WETH_ADDRESS)
      expect(resolveTokenAddress(to)).toBe(WETH_ADDRESS)
    }
  })
})

// ─── Pagination invariants as navigation contracts ───────────────────────────

describe("buildPageNumbers as a navigation contract", () => {
  const currentAndTotal = fc
    .integer({ min: 1, max: 1000 })
    .chain((total) =>
      fc.integer({ min: 1, max: total }).map((current) => ({ current, total }))
    )

  it("the sequence always contains every number a user can reach in one click", () => {
    // A user can jump to: first page, last page, and any page adjacent to
    // `current`. Those must all be present in the rendered sequence.
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const pages = buildPageNumbers(current, total)
        const required = new Set<number>([1, total, current])
        if (current > 1) required.add(current - 1)
        if (current < total) required.add(current + 1)
        for (const n of required) {
          if (!pages.includes(n)) return false
        }
        return true
      })
    )
  })

  it("ellipses only appear between non-adjacent numeric pages", () => {
    // A "..." between two pages whose numeric distance is 1 would be a lie.
    fc.assert(
      fc.property(currentAndTotal, ({ current, total }) => {
        const out = buildPageNumbers(current, total)
        for (let i = 1; i < out.length - 1; i++) {
          if (out[i] === "...") {
            const prev = out[i - 1]
            const next = out[i + 1]
            if (typeof prev === "number" && typeof next === "number") {
              if (next - prev <= 1) return false
            }
          }
        }
        return true
      })
    )
  })
})

// ─── tokenSymbolSchema × rendering: length bound is respected ─────────────────

describe("tokenSymbolSchema — rendering-safety bound", () => {
  it("output length is always ≤ 16 — caller can rely on this for fixed UI slots", () => {
    // The symbol is rendered in fixed-width chips in the swap form and token
    // selector. Any caller that allocates CSS for 16-char max depends on
    // this. An unbounded symbol would overflow and break the layout.
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 16 }), (s) => {
        const out = tokenSymbolSchema.parse(s)
        return out.length <= 16
      })
    )
  })
})
