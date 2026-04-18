import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createMockRequest,
  createMockParams,
  VALID_WALLET,
} from "../utils/mock-next-request"
import { makeTestPool, USER_ONBOARDING_SCHEMA } from "../utils/pg-mem"

// Integration test for /api/user-onboarding/[wallet_address].
//
// Unlike the sibling `user-onboarding.test.ts` — which mocks `pool.query` and
// asserts the SQL string — this file runs a real in-memory Postgres via
// pg-mem. It catches entire categories the mock misses:
//
//   - SQL typos (missing column, wrong table name)
//   - Parameter order mistakes in INSERT/UPDATE
//   - ON CONFLICT semantics on the PUT upsert
//   - RETURNING clauses emitting what the route expects
//   - Whole-row round-trips preserving all seven onboarding booleans
//
// Downside: slightly slower (~50ms per test vs <1ms). Worth it; this is the
// layer where bugs like "we ship an UPDATE that rewrites the wrong row on
// mixed-case wallet input" live.

vi.mock("server-only", () => ({}))

// Create the pool once at module scope so the `vi.mock` below can return the
// same handle for every request. `beforeEach` resets the DB to a clean state
// via the pg-mem backup/restore API.
const testPoolPromise = makeTestPool(async (exec) => {
  await exec(USER_ONBOARDING_SCHEMA)
})

vi.mock("@/lib/settlement/db", async () => {
  const { pool } = await testPoolPromise
  return { pool }
})

// Import AFTER mocks are configured — route pulls `pool` in at load time.
const routePromise = import("@/app/api/user-onboarding/[wallet_address]/route")

describe("user-onboarding API route — pg-mem integration", () => {
  beforeEach(async () => {
    const { reset } = await testPoolPromise
    await reset()
  })

  it("GET returns 404 for a wallet with no row", async () => {
    const { GET } = await routePromise
    const response = await GET(
      createMockRequest(undefined, "GET"),
      createMockParams(VALID_WALLET)
    )
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error).toBe("User not found")
  })

  it("POST creates a row on first write and round-trips via GET", async () => {
    const { POST, GET } = await routePromise
    const created = await POST(
      createMockRequest({ connect_wallet_completed: true, x_completed: true }),
      createMockParams(VALID_WALLET)
    )
    expect(created.status).toBe(201)
    const createdJson = await created.json()
    expect(createdJson.user.wallet_address).toBe(VALID_WALLET.toLowerCase())
    expect(createdJson.user.connect_wallet_completed).toBe(true)
    expect(createdJson.user.x_completed).toBe(true)
    // Unset fields default to false — proves the column defaults work.
    expect(createdJson.user.setup_rpc_completed).toBe(false)
    expect(createdJson.user.email_completed).toBe(false)

    const read = await GET(
      createMockRequest(undefined, "GET"),
      createMockParams(VALID_WALLET)
    )
    expect(read.status).toBe(200)
    const readJson = await read.json()
    expect(readJson.user).toEqual(createdJson.user)
  })

  it("POST on an existing row only updates provided fields", async () => {
    const { POST, GET } = await routePromise
    // Seed a row with connect_wallet and x both true.
    await POST(
      createMockRequest({ connect_wallet_completed: true, x_completed: true }),
      createMockParams(VALID_WALLET)
    )
    // Update only setup_rpc; connect_wallet and x must remain true.
    await POST(
      createMockRequest({ setup_rpc_completed: true }),
      createMockParams(VALID_WALLET)
    )

    const read = await GET(
      createMockRequest(undefined, "GET"),
      createMockParams(VALID_WALLET)
    )
    const json = await read.json()
    expect(json.user.setup_rpc_completed).toBe(true)
    expect(json.user.connect_wallet_completed).toBe(true)
    expect(json.user.x_completed).toBe(true)
    expect(json.user.discord_completed).toBe(false)
  })

  it("POST returns 400 when no valid fields are sent after the row exists", async () => {
    const { POST } = await routePromise
    await POST(createMockRequest({ x_completed: true }), createMockParams(VALID_WALLET))
    const second = await POST(createMockRequest({}), createMockParams(VALID_WALLET))
    expect(second.status).toBe(400)
    const json = await second.json()
    expect(json.error).toBe("No fields to update")
  })

  it("PUT upserts — creates on first call, replaces on second", async () => {
    const { PUT, GET } = await routePromise
    // First call creates.
    const created = await PUT(
      createMockRequest({ connect_wallet_completed: true, x_completed: true }),
      createMockParams(VALID_WALLET)
    )
    expect(created.status).toBe(200) // RETURNING always has rows, so it's 200, not 201
    const createdJson = await created.json()
    expect(createdJson.user.connect_wallet_completed).toBe(true)
    expect(createdJson.user.x_completed).toBe(true)

    // Second call REPLACES — missing fields become false.
    const replaced = await PUT(
      createMockRequest({ connect_wallet_completed: false, email_completed: true }),
      createMockParams(VALID_WALLET)
    )
    expect(replaced.status).toBe(200)
    const replacedJson = await replaced.json()
    expect(replacedJson.user.connect_wallet_completed).toBe(false)
    expect(replacedJson.user.email_completed).toBe(true)
    // x was true in create; PUT without the field must reset to false.
    expect(replacedJson.user.x_completed).toBe(false)

    // Confirm via GET.
    const read = await GET(
      createMockRequest(undefined, "GET"),
      createMockParams(VALID_WALLET)
    )
    const readJson = await read.json()
    expect(readJson.user).toEqual(replacedJson.user)
  })

  it("normalizes mixed-case wallet input to a single lower-cased row", async () => {
    // The Zod schema lower-cases; confirm the DB row agrees. Mixed-case
    // inputs must never create a second row. We deliberately keep the
    // `0x` prefix lower-case here — EIP-55 spec uses lower-case `0x` and
    // `walletAddressSchema` rejects `0X`, which is correct behavior.
    const { POST, GET } = await routePromise
    const mixed = "0xABCdef1234567890ABCdef1234567890ABCdef12"
    const postMixed = await POST(
      createMockRequest({ x_completed: true }),
      createMockParams(mixed)
    )
    expect(postMixed.status).toBe(201)

    const postLower = await POST(
      createMockRequest({ discord_completed: true }),
      createMockParams(mixed.toLowerCase())
    )
    expect(postLower.status).toBe(200)

    // Any casing variant of the hex body that keeps `0x` lower-case reads
    // the same row.
    const read = await GET(
      createMockRequest(undefined, "GET"),
      createMockParams(mixed)
    )
    expect(read.status).toBe(200)
    const json = await read.json()
    expect(json.user.wallet_address).toBe(mixed.toLowerCase())
    expect(json.user.x_completed).toBe(true)
    expect(json.user.discord_completed).toBe(true)
  })

  it("rejects a malformed wallet address with a Zod 400 BEFORE hitting the DB", async () => {
    const { GET, PUT, POST } = await routePromise
    // GET with `createMockRequest(undefined, "GET")` because WHATWG Request
    // rejects bodies on GET/HEAD — an unrelated platform constraint.
    const cases = [
      { handler: GET, method: "GET" as const, body: undefined },
      { handler: POST, method: "POST" as const, body: {} },
      { handler: PUT, method: "PUT" as const, body: {} },
    ]
    for (const { handler, method, body } of cases) {
      const res = await handler(
        createMockRequest(body, method),
        createMockParams("not-a-wallet")
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe("Invalid request")
      expect(json.issues[0].path).toBe("wallet_address")
    }
  })
})
