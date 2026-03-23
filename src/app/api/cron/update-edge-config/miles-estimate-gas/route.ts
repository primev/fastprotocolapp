import { NextResponse } from "next/server"
import { patchEdgeConfigItems } from "@/lib/vercel-edge-config"
import { getAnalyticsClient } from "@/lib/analytics/client"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of recent L1 swap transaction hashes to sample from the analytics DB.
 * Controls the trade-off between accuracy and Alchemy RPC call volume.
 */
const SAMPLE_SIZE = 200

/** Timeout per individual Alchemy RPC receipt fetch (ms). */
const RPC_TIMEOUT_MS = 5_000

/**
 * How many Alchemy RPC receipt requests to run concurrently.
 * Alchemy free tier allows ~25 CU/s; each getTransactionReceipt is 15 CU,
 * so 5 concurrent keeps us safely under the limit.
 */
const RPC_CONCURRENCY = 5

/**
 * Fallback value if we can't compute a real average.
 * Matches the current hardcoded FAST_SWAP_AVG_GAS in `use-estimated-miles.ts`.
 */
const FALLBACK_GAS_AVERAGE = 450_000

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
 * Receipt data extracted from an L1 transaction receipt.
 */
type ReceiptData = {
  gasUsed: number
  effectiveGasPrice: number
}

/**
 * Fetches `gasUsed` and `effectiveGasPrice` from a single L1 transaction
 * receipt via Alchemy.
 *
 * Returns `null` on any failure (timeout, not found, malformed response)
 * so the caller can filter out nulls without aborting the whole batch.
 */
async function fetchReceipt(rpcUrl: string, txHash: string): Promise<ReceiptData | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)

  try {
    const response = await fetch(rpcUrl, {
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
     * `data.result.gasUsed` and `data.result.effectiveGasPrice` are hex strings.
     * Gas values for individual transactions fit within JS safe integer range.
     */
    const gasUsedHex: string | undefined = data?.result?.gasUsed
    const effectiveGasPriceHex: string | undefined = data?.result?.effectiveGasPrice
    if (!gasUsedHex || !effectiveGasPriceHex) return null

    const gasUsed = Number(gasUsedHex)
    const effectiveGasPrice = Number(effectiveGasPriceHex)

    if (!Number.isFinite(gasUsed) || gasUsed <= 0) return null
    if (!Number.isFinite(effectiveGasPrice) || effectiveGasPrice <= 0) return null

    return { gasUsed, effectiveGasPrice }
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

/**
 * Fetches receipts for a batch of L1 transaction hashes with bounded
 * concurrency against Alchemy.
 *
 * @returns Array of ReceiptData (nulls filtered out).
 */
async function batchFetchReceipts(rpcUrl: string, hashes: string[]): Promise<ReceiptData[]> {
  const results: ReceiptData[] = []

  for (let i = 0; i < hashes.length; i += RPC_CONCURRENCY) {
    const chunk = hashes.slice(i, i + RPC_CONCURRENCY)
    const chunkResults = await Promise.all(chunk.map((h) => fetchReceipt(rpcUrl, h)))

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
 * Computes the average gas used by recent FastSwap transactions on Ethereum L1.
 *
 * ### Pipeline
 * 1. Query the analytics DB (`processed_l1_txns_v2`) for the most recent
 *    L1 swap transaction hashes, ordered by timestamp descending.
 * 2. Batch-fetch each transaction's receipt from Alchemy's Ethereum mainnet
 *    RPC to extract `gasUsed`.
 * 3. Compute the arithmetic mean.
 *
 * ### Why this two-step approach?
 * The analytics database stores L1 swap metadata (volume, addresses, timestamps)
 * but does **not** store L1 gas data.  The `receipts` table in the DB contains
 * mev-commit chain (57173) receipts, not Ethereum L1 receipts.  L1 gas usage
 * is only available via an Ethereum RPC node.
 *
 * ### Why a number (not bigint)?
 * Edge Config preserves JSON types.  Storing the value as a raw `number`
 * means the read side (`get<number>("miles_estimate_gas_limit_average")`)
 * receives a `number` directly — no parsing needed.
 *
 * @returns The average gas used as a plain integer, or FALLBACK_GAS_AVERAGE
 *          if insufficient data is available.
 */
async function getMonthlyGasAverage(): Promise<number> {
  const rpcUrl = getAlchemyRpcUrl()
  const client = getAnalyticsClient()

  /**
   * Step 1 — Fetch recent L1 swap transaction hashes from the analytics DB.
   *
   * Uses `processed_l1_txns_v2.l1_tx_hash` (without 0x prefix in DB, we
   * prepend it in the query) ordered by `l1_timestamp DESC` to get the
   * most recent swaps.
   */
  const rows = await client.execute("l1/get-recent-swap-tx-hashes", { limit: SAMPLE_SIZE })

  if (rows.length === 0) {
    console.warn(
      "[cron/miles-estimate-gas] No L1 swap tx hashes returned from analytics DB — using fallback"
    )
    return FALLBACK_GAS_AVERAGE
  }

  /**
   * Each row is a single-element array: [tx_hash].
   * The query prepends '0x' so hashes are ready for RPC calls.
   */
  const hashes = rows
    .map((row) => row[0] as string)
    .filter((h) => typeof h === "string" && h.startsWith("0x"))

  console.log(
    `[cron/miles-estimate-gas] Fetched ${hashes.length} L1 swap tx hashes, fetching receipts from Alchemy…`
  )

  /**
   * Step 2 — Batch-fetch receipts (gasUsed + effectiveGasPrice) from Alchemy.
   */
  const receipts = await batchFetchReceipts(rpcUrl, hashes)

  if (receipts.length === 0) {
    console.warn("[cron/miles-estimate-gas] No valid receipts from Alchemy — using fallback")
    return FALLBACK_GAS_AVERAGE
  }

  /**
   * Step 3 — Compute per-tx costs and log the full breakdown.
   *
   * effectiveGasPrice = baseFeePerGas + priorityFeePerGas (in wei).
   * totalCost = gasUsed × effectiveGasPrice (in wei, logged in gwei).
   */
  const txData = receipts.map((r) => ({
    gasUsed: r.gasUsed,
    effectiveGasPrice: r.effectiveGasPrice,
    totalCost: r.gasUsed * r.effectiveGasPrice,
  }))

  // Per-tx breakdown
  console.log(`[cron/miles-estimate-gas] Per-tx breakdown (${txData.length} txs):`)
  for (let i = 0; i < txData.length; i++) {
    const t = txData[i]
    console.log(
      `  tx ${String(i + 1).padStart(3)}: ` +
        `gasUsed=${t.gasUsed.toLocaleString().padStart(10)}  ` +
        `effectiveGasPrice=${(t.effectiveGasPrice / 1e9).toFixed(4).padStart(10)} gwei  ` +
        `totalCost=${(t.totalCost / 1e9).toFixed(4).padStart(18)} gwei`
    )
  }

  // gasUsed stats
  const gasValues = txData.map((t) => t.gasUsed).sort((a, b) => a - b)
  const gasAvg = Math.round(gasValues.reduce((a, g) => a + g, 0) / gasValues.length)
  console.log(
    `[cron/miles-estimate-gas] gasUsed — min: ${gasValues[0].toLocaleString()}  median: ${gasValues[Math.floor(gasValues.length / 2)].toLocaleString()}  mean: ${gasAvg.toLocaleString()}  max: ${gasValues[gasValues.length - 1].toLocaleString()}`
  )

  // effectiveGasPrice stats
  const gasPrices = txData.map((t) => t.effectiveGasPrice).sort((a, b) => a - b)
  const gpAvg = Math.round(gasPrices.reduce((a, f) => a + f, 0) / gasPrices.length)
  console.log(
    `[cron/miles-estimate-gas] effectiveGasPrice — min: ${(gasPrices[0] / 1e9).toFixed(4)} gwei  median: ${(gasPrices[Math.floor(gasPrices.length / 2)] / 1e9).toFixed(4)} gwei  mean: ${(gpAvg / 1e9).toFixed(4)} gwei  max: ${(gasPrices[gasPrices.length - 1] / 1e9).toFixed(4)} gwei`
  )

  // totalCost stats
  const costs = txData.map((t) => t.totalCost).sort((a, b) => a - b)
  const costAvg = Math.round(costs.reduce((a, c) => a + c, 0) / costs.length)
  console.log(
    `[cron/miles-estimate-gas] totalCost (gasUsed × effectiveGasPrice) — min: ${(costs[0] / 1e9).toFixed(4)} gwei  median: ${(costs[Math.floor(costs.length / 2)] / 1e9).toFixed(4)} gwei  mean: ${(costAvg / 1e9).toFixed(4)} gwei  max: ${(costs[costs.length - 1] / 1e9).toFixed(4)} gwei`
  )
  console.log(`[cron/miles-estimate-gas] totalCost mean in ETH: ${(costAvg / 1e18).toFixed(8)} ETH`)

  console.log(
    `[cron/miles-estimate-gas] Result: gasUsed average = ${gasAvg} ` +
      `(from ${receipts.length}/${hashes.length} successful receipt fetches)`
  )

  return gasAvg
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
 * 2. Queries the analytics DB for recent L1 swap tx hashes, then fetches
 *    their receipts from Alchemy to compute the average gasUsed.
 * 3. Writes (upserts) the `miles_estimate_gas_limit_average` key in the
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
     * We use "upsert" so the key is created on the very first run and
     * updated on all subsequent runs — no manual Edge Config setup needed.
     */
    const result = await patchEdgeConfigItems([
      {
        operation: "upsert",
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
