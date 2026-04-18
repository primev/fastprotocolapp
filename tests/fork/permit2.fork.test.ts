import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { spawn, type ChildProcess } from "node:child_process"
import { createPublicClient, http, keccak256, toBytes, encodeAbiParameters } from "viem"
import { mainnet } from "viem/chains"
import { PERMIT2_ADDRESS } from "@/lib/swap/constants"

// Fork test: verify our EIP-712 domain separator for Permit2 matches what
// the real on-chain contract returns from its `DOMAIN_SEPARATOR()` view.
//
// This closes the last loop around our signing code: unit + property tests
// prove our encoding is internally consistent; this test proves our
// encoding matches the deployed Permit2 bytecode byte-for-byte. If the
// contract is ever redeployed with a different name / chainId / typehash,
// this fails immediately.
//
// Why gated on FORK_RPC_URL:
//   - Anvil forking requires network access to a mainnet RPC. Public
//     endpoints rate-limit and occasionally return errors.
//   - We don't want the default `npm test` to depend on the internet or
//     on any particular RPC being up. A missing env var means "skip."
//
// Enable with:
//   FORK_RPC_URL=https://eth.llamarpc.com npm run test:run -- tests/fork
//
// Permit2 is deployed at the same address on every chain that ships it,
// using CREATE2 with a fixed salt. Testing against mainnet is sufficient
// because any chain-specific domain drift would also move this snapshot.

const FORK_RPC_URL = process.env.FORK_RPC_URL
const ANVIL_PORT = 18545
const ANVIL_URL = `http://127.0.0.1:${ANVIL_PORT}`

// Permit2's on-chain DOMAIN_SEPARATOR — also pinned in
// tests/lib/swap/permit2-utils.test.ts. The two must agree.
const EXPECTED_DOMAIN_SEPARATOR =
  "0x866a5aba21966af95d6c7ab78eb2b2fc913915c28be3b9aa07cc04ff903e3f28"

const skip = !FORK_RPC_URL

let anvilProcess: ChildProcess | null = null

async function waitForAnvil(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(ANVIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      })
      if (res.ok) return
    } catch {
      // anvil not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`anvil at ${ANVIL_URL} did not become reachable within ${timeoutMs}ms`)
}

describe.skipIf(skip)("Permit2 on mainnet-forked anvil", () => {
  beforeAll(async () => {
    if (!FORK_RPC_URL) return
    anvilProcess = spawn(
      "anvil",
      ["--fork-url", FORK_RPC_URL, "--port", String(ANVIL_PORT), "--silent"],
      { stdio: ["ignore", "ignore", "pipe"] }
    )
    anvilProcess.on("error", (err) => {
      console.error("anvil failed to spawn:", err)
    })
    await waitForAnvil()
  }, 30_000)

  afterAll(() => {
    if (anvilProcess && !anvilProcess.killed) {
      anvilProcess.kill("SIGTERM")
    }
  })

  it("DOMAIN_SEPARATOR() returns the hash we snapshot off-chain", async () => {
    const client = createPublicClient({ chain: mainnet, transport: http(ANVIL_URL) })

    // readContract with an inline minimal ABI — we don't want a dependency
    // on the full Permit2 ABI JSON just for one view call. The
    // `authorizationList` field is a viem 2.x type-level quirk (EIP-7702
    // readiness); passing undefined is correct for a plain read.
    const onChain = await client.readContract({
      address: PERMIT2_ADDRESS,
      abi: [
        {
          inputs: [],
          name: "DOMAIN_SEPARATOR",
          outputs: [{ name: "", type: "bytes32" }],
          stateMutability: "view",
          type: "function",
        },
      ] as const,
      functionName: "DOMAIN_SEPARATOR",
      authorizationList: undefined,
    })

    expect(onChain).toBe(EXPECTED_DOMAIN_SEPARATOR)
  }, 30_000)

  it("our off-chain domain-typehash formula is bit-identical to Permit2's", async () => {
    // Belt-and-braces: reconstruct the domain separator from primitives and
    // assert it equals both our snapshot and the on-chain value. If this
    // ever diverges, the test identifies WHICH input changed.
    //
    // EIP-712 uses `abi.encode` (32-byte padded), not `abi.encodePacked`, for
    // the struct encoding. `encodeAbiParameters` is viem's `abi.encode`.
    const typeHash = keccak256(
      toBytes("EIP712Domain(string name,uint256 chainId,address verifyingContract)")
    )
    const nameHash = keccak256(toBytes("Permit2"))
    const encoded = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [typeHash, nameHash, 1n, PERMIT2_ADDRESS]
    )
    const recomputed = keccak256(encoded)
    expect(recomputed).toBe(EXPECTED_DOMAIN_SEPARATOR)
  })
})
