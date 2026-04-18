import { z } from "zod"

// Zod schemas for upstream third-party responses.
//
// Why: the app proxies Fuul, Barter, and FastSwap. None of these contracts
// are owned by us; each provider reserves the right to rename fields, change
// types, or add/remove keys at any time. When that happens today we find out
// because a user's UI goes blank and someone pages on-call.
//
// These schemas give us two things:
//   1. A runtime guard — routes that parse upstream data should safeParse
//      against these schemas and fail fast with a typed 502 instead of
//      producing `undefined` deep in the render tree.
//   2. A contract snapshot — the tests under `tests/lib/api/upstream.test.ts`
//      feed representative fixtures through these schemas and fail loudly
//      if either side drifts. That gives us a canary before an incident.

// ─── Fuul ────────────────────────────────────────────────────────────────────

/**
 * One entry from `GET /api/v1/payouts/leaderboard/points`.
 *
 * Field naming and types mirror what Fuul documents + what we've observed
 * in practice (they send `total_amount` as a number, not a string, despite
 * what the older code assumed). `referred_users` is optional because older
 * entries predate the field.
 */
export const fuulLeaderboardEntrySchema = z.object({
  address: z.string(),
  user_identifier: z.string(),
  user_identifier_type: z.string(),
  total_amount: z.number(),
  total_attributions: z.number(),
  rank: z.number().int(),
  affiliate_code: z.string().optional(),
  referred_users: z.number().int().optional(),
})

export const fuulLeaderboardResponseSchema = z.object({
  results: z.array(fuulLeaderboardEntrySchema),
  total_results: z.number().int(),
})

export type FuulLeaderboardResponse = z.infer<typeof fuulLeaderboardResponseSchema>

/**
 * `GET /api/v1/payouts/totals/{address}`. Fuul has historically sent `total_points`
 * as a string ("0") rather than a number, so the schema coerces. The other
 * field names are all fallbacks we've seen in different Fuul deployments.
 */
export const fuulPayoutsTotalsSchema = z.object({
  total_points: z.coerce.number().optional(),
  total_payouts: z.coerce.number().optional(),
  total: z.coerce.number().optional(),
  points: z.coerce.number().optional(),
})

export type FuulPayoutsTotals = z.infer<typeof fuulPayoutsTotalsSchema>

// ─── Barter ──────────────────────────────────────────────────────────────────

/**
 * `POST /route` response from Barter. `outputWithGasAmount` and
 * `gasEstimation` are load-bearing — the swap form treats a missing field as
 * "invalid response" and refuses to proceed. Optional fields are surfaced in
 * the UI details panel but don't block the quote.
 */
export const barterRouteResponseSchema = z.object({
  outputWithGasAmount: z.union([z.string(), z.number()]),
  gasEstimation: z.union([z.string(), z.number()]),
  transactionFee: z.union([z.string(), z.number()]).optional(),
  gasPrice: z.union([z.string(), z.number()]).optional(),
})

export type BarterRouteResponse = z.infer<typeof barterRouteResponseSchema>
