import { NextResponse } from "next/server"
import { patchEdgeConfigItems } from "@/lib/vercel-edge-config"
import { getAnalyticsClient } from "@/lib/analytics/client"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of recent swap transaction hashes to sample from the analytics DB.
 *
 * We fetch receipts individually via RPC (the analytics DB doesn't store gas
 * data), so this controls the trade-off between accuracy and RPC call volume.
 * 200 gives a statistically meaningful sample while keeping the cron execution
 * well under Vercel's 60-second function timeout.
 */
const SAMPLE_SIZE = 200

/**
 * Timeout per individual RPC receipt fetch (ms).
 * Matches the timeout used in `transaction-receipt-utils.ts`.
 */
const RPC_TIMEOUT_MS = 5_000

/**
 * How many RPC receipt requests to run concurrently.
 * Keeps us from overwhelming the FastRPC endpoint while still finishing
 * quickly.  At 20 concurrent × 5s max timeout ≈ worst-case ~50s for 200 txns.
 */
const RPC_CONCURRENCY = 20

/**
 * Fallback value if we can't compute a real average (no data, RPC failures,
 * etc.).  Matches the current hardcoded FAST_SWAP_AVG_GAS in
 * `use-estimated-miles.ts` so the miles formula remains consistent.
 */
const FALLBACK_GAS_AVERAGE = 450_000

/**
 * FastRPC endpoint for fetching transaction receipts.
 * Same endpoint used in `transaction-receipt-utils.ts`.
 */
const RPC_URL = "https://fastrpc.mev-commit.xyz"

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Validates the incoming request against the `CRON_SECRET` environment variable.
 *
 * ### How Vercel Cron authentication works
 *
 * When you define a cron job in `vercel.json`, Vercel automatically creates a
 * `CRON_SECRET` env var for the project and sends it as a Bearer token in the
 * `Authorization` header on every scheduled invocation.  This prevents
 * unauthenticated external callers from triggering the endpoint.
 *
 * For **manual triggers** via the Vercel Dashboard the same header is sent, so
 * this single check covers both scheduled and manual invocations.
 *
 * @returns `true` if the request is authorised, `false` otherwise.
 */
function isAuthorised(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  /**
   * If CRON_SECRET is not set we reject unconditionally — failing open would
   * allow anyone to hit this endpoint and mutate Edge Config.
   */
  if (!cronSecret) {
    console.error("[cron/miles-estimate-gas] CRON_SECRET is not configured")
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------

/**
 * Fetches the `gasUsed` field from a single transaction receipt via JSON-RPC.
 *
 * Returns `null` on any failure (timeout, not found, malformed response) so
 * the caller can simply filter out nulls without aborting the whole batch.
 *
 * ### Why not reuse `fetchTransactionReceiptFromDb`?
 * That utility converts the full receipt into a viem `TransactionReceipt`
 * (with BigInt fields, logs, etc.) — far more work than we need here.  We
 * only need the `gasUsed` hex string, so a lightweight fetch is faster and
 * avoids importing viem in a server-only route.
 */
async function fetchGasUsed(txHash: string): Promise<number | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txHash],
        id: 1,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await response.json()

    /**
     * `data.result` is null when the RPC node hasn't indexed the tx yet.
     * `data.result.gasUsed` is a hex string like "0x6ddd0".
     */
    const gasUsedHex: string | undefined = data?.result?.gasUsed
    if (!gasUsedHex) return null

    /**
     * Parse the hex string to a plain number.  Gas values for individual
     * transactions fit comfortably within JS's safe integer range (2^53),
     * so Number() is fine here — no BigInt needed.
     */
    const gasUsed = Number(gasUsedHex)
    return Number.isFinite(gasUsed) && gasUsed > 0 ? gasUsed : null
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

/**
 * Fetches gas usage for a batch of transaction hashes with bounded concurrency.
 *
 * Uses a simple semaphore pattern rather than a library:  we chunk the array
 * into groups of `RPC_CONCURRENCY` and await each group before starting the
 * next.  This keeps inflight requests capped without external dependencies.
 *
 * @returns Array of gasUsed numbers (nulls filtered out).
 */
async function batchFetchGasUsed(hashes: string[]): Promise<number[]> {
  const results: number[] = []

  for (let i = 0; i < hashes.length; i += RPC_CONCURRENCY) {
    const chunk = hashes.slice(i, i + RPC_CONCURRENCY)
    const chunkResults = await Promise.all(chunk.map(fetchGasUsed))

    for (const gas of chunkResults) {
      if (gas !== null) results.push(gas)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

/**
 * Computes the average gas used by recent FastSwap transactions.
 *
 * ### Pipeline
 * 1. Query the analytics DB for the most recent `SAMPLE_SIZE` confirmed swap
 *    transaction hashes (cross-referencing `mctransactions_sr` with
 *    `processed_l1_txns_v2` to ensure we only sample actual swaps).
 * 2. Batch-fetch each transaction's receipt from the FastRPC endpoint.
 * 3. Extract `gasUsed` from each receipt and compute the arithmetic mean.
 *
 * ### Why this two-step approach?
 * The analytics database stores swap metadata (volume, addresses, timestamps)
 * but does **not** store gas data.  Gas usage is only available in the
 * on-chain transaction receipt, which we must fetch from the RPC node.
 *
 * ### Why a number (not bigint)?
 * Edge Config preserves JSON types.  Storing the value as a raw `number`
 * means the read side (`get<number>("miles_estimate_gas_limit_average")`)
 * receives a `number` directly — no `parseInt` / `parseFloat` needed.
 * This is consistent with how `tx_confirmation_timeout_ms` is stored.
 * Individual gas values are well within JS's safe integer range.
 *
 * @returns The average gas used as a plain integer, or FALLBACK_GAS_AVERAGE
 *          if insufficient data is available.
 */
async function getMonthlyGasAverage(): Promise<number> {
  const client = getAnalyticsClient()

  /**
   * Step 1 — Fetch recent swap transaction hashes from the analytics DB.
   *
   * The query joins `mctransactions_sr` (which has the tx hash and
   * confirmation status) with `processed_l1_txns_v2` (which flags swaps)
   * to return only confirmed swap hashes, ordered by most recent block.
   */
  const rows = await client.execute(
    "gas/get-recent-swap-tx-hashes",
    { limit: SAMPLE_SIZE },
    {
      /**
       * Use the `default` catalog because the query cross-joins tables from
       * both `pg_mev_commit_fastrpc` and `mevcommit_57173` — the default
       * catalog's Trino/Presto engine can reach both via federated queries.
       */
      catalog: "default",
      timeout: 30_000,
    }
  )

  if (rows.length === 0) {
    console.warn(
      "[cron/miles-estimate-gas] No swap transaction hashes returned from analytics DB — using fallback"
    )
    return FALLBACK_GAS_AVERAGE
  }

  /**
   * Each row is a single-element array: [hash].
   * Hashes from `mctransactions_sr` already include the `0x` prefix.
   */
  const hashes = rows
    .map((row) => row[0] as string)
    .filter((h) => typeof h === "string" && h.startsWith("0x"))

  console.log(
    `[cron/miles-estimate-gas] Fetched ${hashes.length} swap tx hashes, fetching receipts…`
  )

  /**
   * Step 2 — Batch-fetch gasUsed from RPC receipts.
   */
  const gasValues = await batchFetchGasUsed(hashes)

  if (gasValues.length === 0) {
    console.warn(
      "[cron/miles-estimate-gas] No valid gasUsed values retrieved from RPC — using fallback"
    )
    return FALLBACK_GAS_AVERAGE
  }

  /**
   * Step 3 — Compute the arithmetic mean and round to an integer.
   *
   * We use Math.round (not Math.floor) because this is an average — rounding
   * to nearest is more accurate than always rounding down.
   */
  const sum = gasValues.reduce((acc, g) => acc + g, 0)
  const average = Math.round(sum / gasValues.length)

  console.log(
    `[cron/miles-estimate-gas] Computed gas average: ${average} ` +
      `(from ${gasValues.length}/${hashes.length} successful receipt fetches)`
  )

  return average
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/cron/update-edge-config/miles-estimate-gas
 *
 * Vercel Cron invokes route handlers via GET.  This endpoint:
 *
 * 1. Authenticates the caller using `CRON_SECRET`.
 * 2. Fetches the latest monthly gas average from on-chain data.
 * 3. Writes (updates) the `miles_estimate_gas_limit_average` key in the
 *    project's Edge Config store via the Vercel REST API.
 * 4. Returns a JSON summary of the result.
 *
 * ### Schedule
 * Configured in `vercel.json` to run at 00:00 UTC on the 1st of every month.
 * Can also be triggered manually from the Vercel Dashboard → Cron Jobs tab.
 */
export async function GET(request: Request) {
  // --- Step 1: Auth guard ---------------------------------------------------
  if (!isAuthorised(request)) {
    console.warn("[cron/miles-estimate-gas] Unauthorised invocation blocked")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // --- Step 2: Fetch the new value ----------------------------------------
    const gasAverage = await getMonthlyGasAverage()

    console.log(`[cron/miles-estimate-gas] Fetched monthly gas average: ${gasAverage}`)

    // --- Step 3: Write to Edge Config ---------------------------------------
    /**
     * We use the "update" operation (not "create") because the key should
     * already exist in Edge Config after initial setup.  If you need the
     * cron to create the key on first run, use "upsert" semantics by
     * changing the operation to "create" — Vercel will no-op if it already
     * exists with the same value.
     */
    const result = await patchEdgeConfigItems([
      {
        operation: "update",
        key: "miles_estimate_gas_limit_average",
        value: gasAverage,
      },
    ])

    console.log(
      "[cron/miles-estimate-gas] Edge Config updated successfully:",
      JSON.stringify(result)
    )

    // --- Step 4: Return success summary -------------------------------------
    return NextResponse.json({
      ok: true,
      updated: {
        key: "miles_estimate_gas_limit_average",
        value: gasAverage,
      },
      vercelResponse: result,
    })
  } catch (error) {
    /**
     * Catch-all for unexpected failures (network errors, missing env vars,
     * Vercel API errors).  We log the full error server-side but return a
     * safe message to the caller.
     */
    console.error("[cron/miles-estimate-gas] Failed to update Edge Config:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
