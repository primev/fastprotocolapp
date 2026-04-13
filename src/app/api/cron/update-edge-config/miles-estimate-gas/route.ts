import { NextResponse } from "next/server"
import { patchEdgeConfigItems } from "@/lib/vercel-edge-config"
import { getAnalyticsClient } from "@/lib/analytics/client"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of recent FastSwap transaction hashes to sample from the analytics DB.
 * Controls the trade-off between accuracy and Alchemy RPC call volume.
 */
const SAMPLE_SIZE = 200

/** Timeout per individual Alchemy RPC fetch (ms). */
const RPC_TIMEOUT_MS = 5_000

/**
 * How many Alchemy RPC requests to run concurrently.
 * Alchemy free tier allows ~25 CU/s; each getTransactionReceipt is 15 CU,
 * so 5 concurrent keeps us safely under the limit.
 */
const RPC_CONCURRENCY = 5

/**
 * Fallback values if we can't compute real averages.
 * Matches the hardcoded defaults in `use-estimated-miles.ts`.
 */
const FALLBACK_GAS_LIMIT = 450_000
const FALLBACK_GAS_USED = 180_000
/** Fallback median surplus rate (0.68% from 2026-04-08 sample). */
const FALLBACK_SURPLUS_RATE = 0.0068

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
// Alchemy RPC helpers
// ---------------------------------------------------------------------------

/**
 * Builds the Alchemy Ethereum mainnet RPC URL from the environment.
 * Falls back to undefined if the key isn't set, which the caller handles.
 */
function getAlchemyRpcUrl(): string {
  const key = process.env.ALCHEMY_API_KEY
  if (!key) {
    throw new Error("ALCHEMY_API_KEY is not configured")
  }
  return `https://eth-mainnet.g.alchemy.com/v2/${key}`
}

/**
 * Gas data extracted from an L1 transaction + receipt pair.
 */
type TxGasData = {
  gasLimit: number
  gasUsed: number
}

/**
 * Fetches both gas limit (from transaction) and gas used (from receipt)
 * for a single L1 transaction via Alchemy using a JSON-RPC batch request.
 *
 * - Gas limit (`txn.gas`) is used for bid cost estimation because the
 *   mev-commit bid is calculated as `priorityFee × txn.Gas()`.
 * - Gas used (`receipt.gasUsed`) is used for gas cost estimation on the
 *   permit path because the relayer only pays for actual gas consumed.
 *
 * Returns `null` on any failure so the caller can filter without aborting.
 */
async function fetchTxGasData(rpcUrl: string, txHash: string): Promise<TxGasData | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [txHash],
          id: 1,
        },
        {
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [txHash],
          id: 2,
        },
      ]),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const results = await response.json()
    if (!Array.isArray(results) || results.length < 2) return null

    const txResult = results.find((r: { id: number }) => r.id === 1)
    const receiptResult = results.find((r: { id: number }) => r.id === 2)

    const gasLimitHex: string | undefined = txResult?.result?.gas
    const gasUsedHex: string | undefined = receiptResult?.result?.gasUsed

    if (!gasLimitHex || !gasUsedHex) return null

    const gasLimit = Number(gasLimitHex)
    const gasUsed = Number(gasUsedHex)

    if (!Number.isFinite(gasLimit) || gasLimit <= 0) return null
    if (!Number.isFinite(gasUsed) || gasUsed <= 0) return null

    return { gasLimit, gasUsed }
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

/**
 * Fetches gas data for a batch of L1 transaction hashes with bounded
 * concurrency against Alchemy.
 *
 * @returns Array of TxGasData (nulls filtered out).
 */
async function batchFetchTxGasData(rpcUrl: string, hashes: string[]): Promise<TxGasData[]> {
  const results: TxGasData[] = []

  for (let i = 0; i < hashes.length; i += RPC_CONCURRENCY) {
    const chunk = hashes.slice(i, i + RPC_CONCURRENCY)
    const chunkResults = await Promise.all(chunk.map((h) => fetchTxGasData(rpcUrl, h)))

    for (const r of chunkResults) {
      if (r !== null) results.push(r)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

/**
 * Computes the average gas limit and gas used of recent FastSwap transactions
 * on Ethereum L1.
 *
 * - Gas limit average is used for bid cost estimation (bid = priorityFee × gasLimit).
 * - Gas used average is used for gas cost estimation on the permit path
 *   (relayer pays actual gas consumed, not the full gas limit).
 *
 * ### Pipeline
 * 1. Query the analytics DB (`fastswap_miles`) for the most recent
 *    processed FastSwap transaction hashes.
 * 2. Batch-fetch each transaction + receipt from Alchemy's Ethereum mainnet
 *    RPC to extract `gas` (limit) and `gasUsed` fields.
 * 3. Compute the arithmetic mean for each.
 *
 * @returns Object with gasLimitAvg and gasUsedAvg, or fallback values
 *          if insufficient data is available.
 */
async function computeGasAverages(): Promise<{ gasLimitAvg: number; gasUsedAvg: number }> {
  const rpcUrl = getAlchemyRpcUrl()
  const client = getAnalyticsClient()

  const rows = await client.execute("fastswap/get-recent-tx-hashes", { limit: SAMPLE_SIZE })

  if (rows.length === 0) {
    console.warn(
      "[cron/miles-estimate-gas] No FastSwap tx hashes returned from analytics DB — using fallbacks"
    )
    return { gasLimitAvg: FALLBACK_GAS_LIMIT, gasUsedAvg: FALLBACK_GAS_USED }
  }

  const hashes = rows
    .map((row) => row[0] as string)
    .filter((h) => typeof h === "string" && h.startsWith("0x"))

  console.log(
    `[cron/miles-estimate-gas] Fetched ${hashes.length} FastSwap tx hashes, fetching transactions from Alchemy…`
  )

  const txs = await batchFetchTxGasData(rpcUrl, hashes)

  if (txs.length === 0) {
    console.warn("[cron/miles-estimate-gas] No valid transactions from Alchemy — using fallbacks")
    return { gasLimitAvg: FALLBACK_GAS_LIMIT, gasUsedAvg: FALLBACK_GAS_USED }
  }

  const gasLimits = txs.map((t) => t.gasLimit).sort((a, b) => a - b)
  const gasUseds = txs.map((t) => t.gasUsed).sort((a, b) => a - b)

  const gasLimitAvg = Math.round(gasLimits.reduce((a, g) => a + g, 0) / gasLimits.length)
  const gasUsedAvg = Math.round(gasUseds.reduce((a, g) => a + g, 0) / gasUseds.length)

  console.log(
    `[cron/miles-estimate-gas] gasLimit — min: ${gasLimits[0].toLocaleString()}  median: ${gasLimits[Math.floor(gasLimits.length / 2)].toLocaleString()}  mean: ${gasLimitAvg.toLocaleString()}  max: ${gasLimits[gasLimits.length - 1].toLocaleString()}`
  )
  console.log(
    `[cron/miles-estimate-gas] gasUsed — min: ${gasUseds[0].toLocaleString()}  median: ${gasUseds[Math.floor(gasUseds.length / 2)].toLocaleString()}  mean: ${gasUsedAvg.toLocaleString()}  max: ${gasUseds[gasUseds.length - 1].toLocaleString()}`
  )

  console.log(
    `[cron/miles-estimate-gas] Result: gasLimitAvg = ${gasLimitAvg}, gasUsedAvg = ${gasUsedAvg} ` +
      `(from ${txs.length}/${hashes.length} successful fetches)`
  )

  return { gasLimitAvg, gasUsedAvg }
}

// ---------------------------------------------------------------------------
// Surplus rate computation
// ---------------------------------------------------------------------------

/**
 * Computes the median surplus rate from recent processed FastSwap transactions.
 *
 * Surplus rate = surplus_eth / output_in_eth for each swap. The median is
 * used (rather than mean) for robustness against outliers — a few high-surplus
 * swaps shouldn't inflate the estimate for typical users.
 *
 * @returns The median surplus rate as a decimal (e.g. 0.0068 = 0.68%),
 *          or FALLBACK_SURPLUS_RATE if insufficient data.
 */
async function computeMedianSurplusRate(): Promise<number> {
  const client = getAnalyticsClient()

  const rows = await client.execute("fastswap/get-surplus-rates", {})

  if (rows.length === 0) {
    console.warn(
      "[cron/miles-estimate-gas] No surplus rate data returned — using fallback"
    )
    return FALLBACK_SURPLUS_RATE
  }

  const rates = rows
    .map((row) => Number(row[0]))
    .filter((r) => Number.isFinite(r) && r > 0)
    .sort((a, b) => a - b)

  if (rates.length === 0) {
    console.warn("[cron/miles-estimate-gas] No valid surplus rates — using fallback")
    return FALLBACK_SURPLUS_RATE
  }

  const mid = Math.floor(rates.length / 2)
  const median =
    rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid]

  // Round to 6 decimal places to avoid floating point noise in Edge Config
  const rounded = Math.round(median * 1e6) / 1e6

  console.log(
    `[cron/miles-estimate-gas] surplusRate — count: ${rates.length}  ` +
      `p10: ${(rates[Math.floor(rates.length * 0.1)] * 100).toFixed(2)}%  ` +
      `p25: ${(rates[Math.floor(rates.length * 0.25)] * 100).toFixed(2)}%  ` +
      `p50: ${(median * 100).toFixed(2)}%  ` +
      `p75: ${(rates[Math.floor(rates.length * 0.75)] * 100).toFixed(2)}%  ` +
      `p90: ${(rates[Math.floor(rates.length * 0.9)] * 100).toFixed(2)}%  ` +
      `mean: ${((rates.reduce((a, r) => a + r, 0) / rates.length) * 100).toFixed(2)}%`
  )

  return rounded
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
 * 2. Queries the analytics DB for recent FastSwap tx hashes, then fetches
 *    their transactions and receipts from Alchemy to compute average
 *    gas limit and gas used.
 * 3. Writes (upserts) `miles_estimate_gas_limit_average` and
 *    `miles_estimate_gas_used_average` keys in the project's Edge Config
 *    store via the Vercel REST API.
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
    // --- Step 2: Fetch the new values ----------------------------------------
    const [gasAverages, surplusRate] = await Promise.all([
      computeGasAverages(),
      computeMedianSurplusRate(),
    ])
    const { gasLimitAvg, gasUsedAvg } = gasAverages

    console.log(
      `[cron/miles-estimate-gas] Computed: gasLimit=${gasLimitAvg}, gasUsed=${gasUsedAvg}, surplusRate=${(surplusRate * 100).toFixed(2)}%`
    )

    // --- Step 3: Write to Edge Config ---------------------------------------
    /**
     * We use "upsert" so the keys are created on the very first run and
     * updated on all subsequent runs — no manual Edge Config setup needed.
     */
    const result = await patchEdgeConfigItems([
      {
        operation: "upsert",
        key: "miles_estimate_gas_limit_average",
        value: gasLimitAvg,
      },
      {
        operation: "upsert",
        key: "miles_estimate_gas_used_average",
        value: gasUsedAvg,
      },
      {
        operation: "upsert",
        key: "miles_estimate_surplus_rate",
        value: surplusRate,
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
        gasLimitAverage: gasLimitAvg,
        gasUsedAverage: gasUsedAvg,
        surplusRate,
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
