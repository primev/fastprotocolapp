import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  fuulLeaderboardResponseSchema,
  fuulPayoutsTotalsSchema,
  barterRouteResponseSchema,
} from "@/lib/api/upstream"

// Upstream API contract snapshots.
//
// Each test loads a stored JSON fixture (under `tests/fixtures/upstream/`)
// and passes it through the corresponding Zod schema. These tests fail
// loudly when either the schema or the fixture drifts — which is the
// canary we want before production discovers the change.
//
// Updating a fixture is how we ratify an upstream change: if Fuul renames
// `total_amount` to `points`, we update the schema, regenerate the fixture,
// and the commit review makes the change visible.

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures", "upstream")

function loadFixture(name: string): unknown {
  const raw = readFileSync(join(FIXTURES_DIR, name), "utf-8")
  return JSON.parse(raw)
}

describe("Fuul /payouts/leaderboard/points — contract snapshot", () => {
  it("parses a realistic response with mixed optional fields", () => {
    const fixture = loadFixture("fuul-leaderboard.json")
    const parsed = fuulLeaderboardResponseSchema.parse(fixture)

    expect(parsed.total_results).toBe(2)
    expect(parsed.results).toHaveLength(2)
    // First row has all optional fields populated.
    expect(parsed.results[0].affiliate_code).toBe("CODE42")
    expect(parsed.results[0].referred_users).toBe(7)
    // Second row omits them; schema must not require them.
    expect(parsed.results[1].affiliate_code).toBeUndefined()
    expect(parsed.results[1].referred_users).toBeUndefined()
  })

  it("rejects a response that drops the `results` array", () => {
    // Simulates a breaking upstream change. The proxy must NOT coerce
    // missing fields to default values — a silent empty list would make
    // the leaderboard look "done loading but empty."
    expect(
      fuulLeaderboardResponseSchema.safeParse({ total_results: 0 }).success
    ).toBe(false)
  })

  it("rejects an entry missing a required field", () => {
    const broken = {
      results: [{ address: "0xabc", user_identifier: "0xabc" /* missing rank, total_amount, ... */ }],
      total_results: 1,
    }
    expect(fuulLeaderboardResponseSchema.safeParse(broken).success).toBe(false)
  })
})

describe("Fuul /payouts/totals/{address} — contract snapshot", () => {
  it("coerces string total_points into a number", () => {
    // The API ships total_points as a string; schemas.ts coerces because the
    // UI does numeric math. A regression to parseFloat downstream would
    // produce NaN — the coerce here prevents that at the boundary.
    const fixture = loadFixture("fuul-payouts-string.json")
    const parsed = fuulPayoutsTotalsSchema.parse(fixture)
    expect(parsed.total_points).toBe(12345)
    expect(typeof parsed.total_points).toBe("number")
  })

  it("accepts the legacy field names Fuul has used historically", () => {
    // Fuul has shipped at least three field names over time; our route
    // walks a fallback chain. Parsing proves the schema accepts each variant
    // so a hot-patch to a different Fuul deployment keeps working.
    const fixture = loadFixture("fuul-payouts-legacy-fields.json")
    const parsed = fuulPayoutsTotalsSchema.parse(fixture)
    expect(parsed.total_payouts).toBe(42)
    expect(parsed.points).toBe(7)
  })

  it("accepts an empty object (user with no Fuul history)", () => {
    // Users who have never earned any points get an empty-ish response.
    // That's not an error — the UI just renders zero.
    expect(fuulPayoutsTotalsSchema.safeParse({}).success).toBe(true)
  })
})

describe("Barter /route — contract snapshot", () => {
  it("parses a full response with all optional fields", () => {
    const fixture = loadFixture("barter-route.json")
    const parsed = barterRouteResponseSchema.parse(fixture)
    // Both string and number forms flow through — the schema tolerates both
    // because Barter has not been consistent about this over versions.
    expect(parsed.outputWithGasAmount).toBe("1000000000000000000")
    expect(parsed.gasEstimation).toBe(210000)
    expect(parsed.transactionFee).toBe("420000000000000")
    expect(parsed.gasPrice).toBe("20000000000")
  })

  it("parses the minimal response (load-bearing fields only)", () => {
    const fixture = loadFixture("barter-route-minimal.json")
    const parsed = barterRouteResponseSchema.parse(fixture)
    expect(parsed.outputWithGasAmount).toBe(1000)
    expect(parsed.gasEstimation).toBe("210000")
    expect(parsed.transactionFee).toBeUndefined()
    expect(parsed.gasPrice).toBeUndefined()
  })

  it("rejects a response missing outputWithGasAmount or gasEstimation", () => {
    // These two are the swap-quote payload; dropping either means we
    // cannot even price the trade. The proxy must bail loudly rather
    // than hand the UI a partial object.
    expect(
      barterRouteResponseSchema.safeParse({ gasEstimation: 1 }).success
    ).toBe(false)
    expect(
      barterRouteResponseSchema.safeParse({ outputWithGasAmount: 1 }).success
    ).toBe(false)
  })
})
