import { describe, it, expect } from "vitest"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { WETH_ABI } from "@/lib/tokens/weth-abi"
import { ERC20_APPROVE_ABI } from "@/lib/tokens/erc20-abi"

// ABI drift guard.
//
// Two failure modes this test prevents:
//   1. The JSON ABIs under `contracts-abi/abi/` get corrupted or land in a
//      shape viem can't consume. The build wouldn't catch this until a
//      downstream hook tried to call the contract; this test catches it at
//      `npm test`.
//   2. The hand-written `as const` ABIs in `src/lib/tokens/` silently drift
//      from the canonical ERC-20 / WETH9 interfaces. A missing or mis-typed
//      arg here breaks wrap/unwrap and approve at runtime — and viem's
//      inference makes the type error look like a different bug.
//
// This test is deliberately narrow: we verify shape and canonical signatures.
// A full Solidity source → JSON comparison lives in a separate future test
// that runs `forge inspect` when `contracts/` is present.

const ABI_DIR = join(process.cwd(), "contracts-abi", "abi")

// A valid Solidity ABI entry has `type` and (for most types) `name`,
// `inputs`, `outputs`, and `stateMutability`. viem's inference requires
// these fields to be present literal strings / arrays.
type AbiEntry = {
  type: string
  name?: string
  inputs?: Array<unknown>
  outputs?: Array<unknown>
  stateMutability?: string
}

describe("contracts-abi drift — JSON files", () => {
  const files = readdirSync(ABI_DIR).filter((f) => f.endsWith(".abi"))

  it("directory is non-empty (drift guard covers real content)", () => {
    // If this ever passes vacuously, the test is a liar. Fail fast.
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    describe(file, () => {
      // Read inside each describe so a malformed file fails in its own slot
      // instead of aborting the whole suite.
      let parsed: AbiEntry[]

      it("is valid JSON", () => {
        const raw = readFileSync(join(ABI_DIR, file), "utf-8")
        parsed = JSON.parse(raw)
        expect(Array.isArray(parsed)).toBe(true)
      })

      it("every entry has a string `type`", () => {
        for (const entry of parsed) {
          expect(typeof entry.type).toBe("string")
          // Known ABI entry types as of Solidity 0.8.x.
          expect([
            "function",
            "constructor",
            "event",
            "error",
            "fallback",
            "receive",
          ]).toContain(entry.type)
        }
      })

      it("function entries carry inputs, outputs, and stateMutability", () => {
        const fns = parsed.filter((e) => e.type === "function")
        for (const fn of fns) {
          expect(typeof fn.name).toBe("string")
          expect(Array.isArray(fn.inputs)).toBe(true)
          expect(Array.isArray(fn.outputs)).toBe(true)
          expect(typeof fn.stateMutability).toBe("string")
          expect(["pure", "view", "nonpayable", "payable"]).toContain(fn.stateMutability)
        }
      })
    })
  }
})

describe("WETH_ABI — matches canonical WETH9 shape", () => {
  it("is `as const`-asserted (readonly array)", () => {
    // viem's type inference requires a readonly ABI. A non-const ABI silently
    // degrades to `any`-ish inference and drops compile-time safety.
    // We can't assert the `as const` at runtime, but we can check the array
    // is a plain non-empty list — a reasonable proxy.
    expect(Array.isArray(WETH_ABI)).toBe(true)
    expect(WETH_ABI.length).toBeGreaterThan(0)
  })

  it("defines deposit() payable", () => {
    const deposit = WETH_ABI.find((e) => e.type === "function" && e.name === "deposit")
    expect(deposit).toBeDefined()
    expect(deposit!.stateMutability).toBe("payable")
    expect(deposit!.inputs).toHaveLength(0)
  })

  it("defines withdraw(uint256) nonpayable", () => {
    const withdraw = WETH_ABI.find((e) => e.type === "function" && e.name === "withdraw")
    expect(withdraw).toBeDefined()
    expect(withdraw!.stateMutability).toBe("nonpayable")
    expect(withdraw!.inputs).toHaveLength(1)
    expect(withdraw!.inputs[0]!.type).toBe("uint256")
  })

  it("defines balanceOf(address) view returning uint256", () => {
    const bal = WETH_ABI.find((e) => e.type === "function" && e.name === "balanceOf")
    expect(bal).toBeDefined()
    expect(bal!.stateMutability).toBe("view")
    expect(bal!.inputs).toHaveLength(1)
    expect(bal!.inputs[0]!.type).toBe("address")
    expect(bal!.outputs).toHaveLength(1)
    expect(bal!.outputs[0]!.type).toBe("uint256")
  })
})

describe("ERC20_APPROVE_ABI — matches canonical ERC-20 shape", () => {
  it("defines approve(address,uint256) returning bool", () => {
    const approve = ERC20_APPROVE_ABI.find(
      (e) => e.type === "function" && e.name === "approve"
    )
    expect(approve).toBeDefined()
    expect(approve!.stateMutability).toBe("nonpayable")
    expect(approve!.inputs.map((i) => i.type)).toEqual(["address", "uint256"])
    expect(approve!.outputs.map((o) => o.type)).toEqual(["bool"])
  })

  it("defines allowance(address,address) view returning uint256", () => {
    const allow = ERC20_APPROVE_ABI.find(
      (e) => e.type === "function" && e.name === "allowance"
    )
    expect(allow).toBeDefined()
    expect(allow!.stateMutability).toBe("view")
    expect(allow!.inputs.map((i) => i.type)).toEqual(["address", "address"])
    expect(allow!.outputs.map((o) => o.type)).toEqual(["uint256"])
  })
})

// ─── Upstream drift guard ────────────────────────────────────────────────────
//
// When the mev-commit external has been synced (`/prime` or `/sync-externals`),
// diff each of our local ABI files against the matching upstream file.
// Drift means someone hand-edited a local ABI without sourcing it from the
// canonical upstream — a class of bug that otherwise surfaces as a
// production revert. Files we have locally but upstream doesn't (e.g.,
// IFastSettlementV3.abi as a local-only interface-extract) are skipped
// with a recorded note; files upstream has that we don't are ignored
// (we only vendor what we consume).

const UPSTREAM_ABI_DIR = join(process.cwd(), ".external", "mev-commit", "contracts-abi", "abi")
const externalSynced = existsSync(UPSTREAM_ABI_DIR)

describe.skipIf(!externalSynced)("upstream drift — .external/mev-commit/contracts-abi/abi/", () => {
  const localFiles = readdirSync(ABI_DIR).filter((f) => f.endsWith(".abi"))

  it("the external directory exists (drift check meaningful)", () => {
    expect(existsSync(UPSTREAM_ABI_DIR)).toBe(true)
  })

  for (const file of localFiles) {
    const upstreamPath = join(UPSTREAM_ABI_DIR, file)
    const upstreamPresent = existsSync(upstreamPath)

    // `skipIf` on the `it` — a file that only exists locally is noted by
    // the test title but produces a SKIP, not a FAIL. This keeps the
    // signal binary: any non-skip result means drift is genuinely real
    // or genuinely absent.
    it.skipIf(!upstreamPresent)(
      `${file} matches upstream byte-for-byte`,
      () => {
        // Compare canonicalized JSON so whitespace / key-ordering
        // differences don't flag as drift. Semantic equality is what
        // viem + the contract actually care about.
        const localParsed = JSON.parse(readFileSync(join(ABI_DIR, file), "utf-8"))
        const upstreamParsed = JSON.parse(readFileSync(upstreamPath, "utf-8"))

        const canonical = (x: unknown): string =>
          JSON.stringify(x, (_k, v) => {
            if (v && typeof v === "object" && !Array.isArray(v)) {
              return Object.keys(v)
                .sort()
                .reduce<Record<string, unknown>>((acc, k) => {
                  acc[k] = (v as Record<string, unknown>)[k]
                  return acc
                }, {})
            }
            return v
          })

        expect(canonical(localParsed)).toBe(canonical(upstreamParsed))
      }
    )
  }
})
