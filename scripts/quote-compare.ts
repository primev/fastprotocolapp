/**
 * ============================================================================
 * quote-compare.ts — "Amount too small to swap" diagnostic
 * ============================================================================
 *
 * WHAT IT DOES
 * ------------
 * When the swap UI displays "Amount too small to swap," it's because the
 * quote-validation hook (src/hooks/use-barter-validation.ts) found that:
 *
 *     shortfall = (uniswapAmountOut − barterAmountOut) / uniswapAmountOut
 *     shortfall > MAX_SLIPPAGE_PCT   (hardcoded to 2.0%)
 *
 * That tells you Uniswap and Barter disagree on price by more than 2% — but
 * NOT which side is the outlier. This script fetches both quotes side-by-side
 * and compares them against an independent reference (CoinGecko spot price)
 * so you can attribute the disagreement.
 *
 * HOW IT WORKS
 * ------------
 *   1. Reads token decimals + symbols on-chain for `source` and `target`.
 *   2. In parallel:
 *      - Uniswap V3 QuoterV2 (same contract & method the app uses) across
 *        all 4 fee tiers; takes the tier with the highest amountOut.
 *      - Barter /route — hits the upstream API2 endpoint directly with your
 *        BARTER_API_KEY, so no dev server is needed.
 *      - CoinGecko `simple/token_price/ethereum` for USD prices of both
 *        contract addresses. Implied fair exchange rate = srcUsd / tgtUsd.
 *   3. Computes implied price per side (target units per 1 source unit),
 *      shortfall %, and each side's deviation from the CoinGecko reference.
 *
 * WHAT THE OUTPUT TELLS YOU
 * -------------------------
 *   - `shortfall`: the exact number the UI gate checks. > 2.00% ⇒ gate fires.
 *   - `uniswap vs mkt` / `barter vs mkt`: signed % deviation from CoinGecko.
 *     Whichever has the larger |%| is the side driving the disagreement.
 *   - `verdict`: one-line attribution ("Uniswap is the outlier" / "Barter is
 *     the outlier"). Common interpretations:
 *       * Uniswap high vs market → thin/shallow v3 pool on the direct pair;
 *         Barter's multi-hop routing is actually closer to fair price.
 *       * Barter low vs market → routing overhead (extra hops, gas) eats
 *         a larger proportion of a small trade — the classic "amount too
 *         small to amortize routing cost" case.
 *       * Both off market → data blip (stale RPC, reorg, CoinGecko lag).
 *
 * OPERATIONAL KNOBS
 * -----------------
 * The 2% gate is a hardcoded const (MAX_SLIPPAGE_PCT in
 * src/hooks/use-barter-validation.ts:10). It is NOT in Edge Config, so you
 * cannot widen it at runtime today. The script prints a "Developer options
 * to unblock this swap" section with three concrete options:
 *   1. One-line code change to widen the gate (pre-filled with the exact
 *      threshold needed to unblock the current trade, rounded up 0.5%).
 *   2. Promote the gate to Edge Config, mirroring the existing quote-guard
 *      pattern (src/app/api/config/quote-guard/route.ts) — recommended.
 *   3. Investigate the outlier side instead (based on the attribution verdict).
 * The existing `quote_guard_*` Edge Config keys guard the opposite
 * direction (Barter > Uniswap, surplus-leak protection) and do NOT affect
 * this gate — this is documented in the printed output.
 *
 * USAGE
 * -----
 *   npx tsx scripts/quote-compare.ts \
 *     --source 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2 \
 *     --target 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
 *     --sell   9490316901682634
 *
 *   --source   ERC-20 contract address of the token being sold (use WETH for ETH).
 *   --target   ERC-20 contract address of the token being bought.
 *   --sell     Sell amount in smallest units (wei for 18-decimal tokens).
 *              Grab it from the `sellAmount` field on a `POST /api/barter/route`
 *              request in DevTools Network tab, or compute it as
 *              humanAmount × 10^decimals.
 *
 * REQUIRES IN .env
 * ----------------
 *   ALCHEMY_API_KEY      (mainnet RPC, already used by the app)
 *   BARTER_API_KEY       (already used by /api/barter/route)
 *   COINGECKO_API_KEY    (optional — CoinGecko Demo key; raises rate limit
 *                         from ~10/min to ~30/min. Script still runs without it.)
 * ============================================================================
 */
import { readFileSync } from "fs"
import { parseArgs } from "node:util"
import { createPublicClient, http, formatUnits, type Address } from "viem"
import { mainnet } from "viem/chains"

const ERC20_READ_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (match) {
    let val = match[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[match[1]] = val
  }
}

const { values } = parseArgs({
  options: {
    source: { type: "string" },
    target: { type: "string" },
    sell: { type: "string" },
  },
})

if (!values.source || !values.target || !values.sell) {
  console.error("Usage: --source 0x.. --target 0x.. --sell <wei>")
  process.exit(1)
}

const SOURCE = values.source.toLowerCase() as Address
const TARGET = values.target.toLowerCase() as Address
const SELL = BigInt(values.sell)

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY
const BARTER_KEY = process.env.BARTER_API_KEY
if (!ALCHEMY_KEY) { console.error("Missing ALCHEMY_API_KEY in .env"); process.exit(1) }
if (!BARTER_KEY) { console.error("Missing BARTER_API_KEY in .env"); process.exit(1) }

const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const
const FEE_TIERS = [100, 500, 3000, 10000] as const
const QUOTER_ABI = [
  {
    inputs: [{
      components: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "fee", type: "uint24" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
      name: "params",
      type: "tuple",
    }],
    name: "quoteExactInputSingle",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const

const client = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
})

async function getDecimalsAndSymbol(addr: Address) {
  const [decimals, symbol] = await Promise.all([
    client.readContract({ address: addr, abi: ERC20_READ_ABI, functionName: "decimals" }),
    client.readContract({ address: addr, abi: ERC20_READ_ABI, functionName: "symbol" }),
  ])
  return { decimals, symbol }
}

async function uniswapBestQuote(amountIn: bigint): Promise<{ amountOut: bigint; fee: number } | null> {
  const results = await Promise.allSettled(
    FEE_TIERS.map((fee) =>
      client.simulateContract({
        address: QUOTER_V2,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: SOURCE, tokenOut: TARGET, amountIn, fee, sqrtPriceLimitX96: 0n }],
      })
    )
  )
  let best: { amountOut: bigint; fee: number } | null = null
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const out = r.value.result[0] as bigint
      if (!best || out > best.amountOut) best = { amountOut: out, fee: FEE_TIERS[i] }
    }
  })
  return best
}

async function barterQuote(): Promise<bigint> {
  const resp = await fetch("https://api2.eth.barterswap.xyz/route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BARTER_KEY}`,
    },
    body: JSON.stringify({ source: SOURCE, target: TARGET, sellAmount: SELL.toString() }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`Barter ${resp.status}: ${JSON.stringify(data)}`)
  return BigInt(data.outputWithGasAmount)
}

async function coingeckoUsd(addrs: Address[]): Promise<Record<string, number>> {
  const url = new URL("https://api.coingecko.com/api/v3/simple/token_price/ethereum")
  url.searchParams.set("contract_addresses", addrs.join(","))
  url.searchParams.set("vs_currencies", "usd")
  if (process.env.COINGECKO_API_KEY) {
    url.searchParams.set("x_cg_demo_api_key", process.env.COINGECKO_API_KEY)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const json = (await res.json()) as Record<string, { usd: number }>
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(json)) out[k.toLowerCase()] = v.usd
  return out
}

const [{ decimals: decIn, symbol: symIn }, { decimals: decOut, symbol: symOut }, uniRaw, barterOut, cg] =
  await Promise.all([
    getDecimalsAndSymbol(SOURCE),
    getDecimalsAndSymbol(TARGET),
    uniswapBestQuote(SELL),
    barterQuote(),
    coingeckoUsd([SOURCE, TARGET]).catch((e) => {
      console.warn(`CoinGecko failed: ${e.message}`)
      return {} as Record<string, number>
    }),
  ])

if (!uniRaw) {
  console.error("Uniswap returned no quote on any fee tier — pair may not exist on v3")
  process.exit(1)
}
const uni = uniRaw as { amountOut: bigint; fee: number }

const sellHuman = Number(formatUnits(SELL, decIn))
const uniHuman = Number(formatUnits(uni.amountOut, decOut))
const barterHuman = Number(formatUnits(barterOut, decOut))

const uniPrice = uniHuman / sellHuman // target per source
const barterPrice = barterHuman / sellHuman

const srcUsd = cg[SOURCE]
const tgtUsd = cg[TARGET]
const marketPrice = srcUsd && tgtUsd ? srcUsd / tgtUsd : null

const shortfallPct =
  uni.amountOut > 0n
    ? Number(((uni.amountOut - barterOut) * 10000n) / uni.amountOut) / 100
    : 0

const GATE_PCT = 2.0 // mirrors MAX_SLIPPAGE_PCT in src/hooks/use-barter-validation.ts

console.log("")
console.log("── Inputs ────────────────────────────────────────────────────────────")
console.log(`  sell           : ${sellHuman} ${symIn}  (${SELL} wei)`)
console.log(`  pair           : ${symIn} → ${symOut}`)
console.log("")
console.log("── Quotes ────────────────────────────────────────────────────────────")
console.log(`  uniswap out    : ${uniHuman} ${symOut}  (best fee tier ${uni.fee / 10000}%)`)
console.log(`                   → implied price: ${uniPrice.toFixed(6)} ${symOut}/${symIn}`)
console.log(`  barter  out    : ${barterHuman} ${symOut}`)
console.log(`                   → implied price: ${barterPrice.toFixed(6)} ${symOut}/${symIn}`)
if (marketPrice) {
  console.log(`  market  (CG)   : $${srcUsd} / $${tgtUsd}`)
  console.log(`                   → implied price: ${marketPrice.toFixed(6)} ${symOut}/${symIn}`)
} else {
  console.log(`  market  (CG)   : unavailable (no key or CoinGecko 429)`)
}
console.log("")
console.log("── Gate check ────────────────────────────────────────────────────────")
console.log(`  shortfall      : ${shortfallPct.toFixed(2)}%   (Uniswap vs Barter)`)
console.log(`  gate threshold : ${GATE_PCT.toFixed(2)}%   (MAX_SLIPPAGE_PCT, hardcoded)`)
console.log(
  `  result         : ${
    shortfallPct > GATE_PCT
      ? `ABOVE threshold → button shows "Amount too small to swap"`
      : `BELOW threshold → swap is allowed`
  }`
)

if (marketPrice) {
  const uniDev = ((uniPrice - marketPrice) / marketPrice) * 100
  const barterDev = ((barterPrice - marketPrice) / marketPrice) * 100
  console.log("")
  console.log("── Attribution (vs CoinGecko reference) ──────────────────────────────")
  console.log(`  uniswap vs mkt : ${uniDev >= 0 ? "+" : ""}${uniDev.toFixed(2)}%`)
  console.log(`  barter  vs mkt : ${barterDev >= 0 ? "+" : ""}${barterDev.toFixed(2)}%`)
  const outlierIsUni = Math.abs(uniDev) > Math.abs(barterDev)
  const outlierPct = outlierIsUni ? uniDev : barterDev
  const outlierName = outlierIsUni ? "Uniswap" : "Barter"
  console.log(
    `  verdict        : ${outlierName} is the outlier (${outlierPct >= 0 ? "+" : ""}${outlierPct.toFixed(2)}% vs market)`
  )
  const hint = outlierIsUni
    ? uniDev > 0
      ? "  hint           : Uniswap quoting high usually means a thin single-hop pool;\n                   Barter's multi-hop route is closer to fair price."
      : "  hint           : Uniswap quoting low is unusual — check for stale RPC or reorg."
    : barterDev < 0
      ? "  hint           : Barter quoting low usually means routing overhead (extra hops,\n                   gas) eats a larger share of a small trade — amount may genuinely\n                   be too small to amortize routing cost."
      : "  hint           : Barter quoting high is unusual — check for stale cache on their side."
  console.log(hint)
}
console.log("")
console.log("── Developer options to unblock this swap ────────────────────────────")

if (shortfallPct <= GATE_PCT) {
  console.log("  Gate not triggered — no action needed for this input.")
  console.log("")
} else if (!marketPrice) {
  console.log("  CoinGecko reference unavailable — cannot attribute the outlier.")
  console.log("  Rerun with COINGECKO_API_KEY set for targeted recommendations.")
  console.log("")
} else {
  const uniDev = ((uniPrice - marketPrice) / marketPrice) * 100
  const barterDev = ((barterPrice - marketPrice) / marketPrice) * 100
  const outlierIsUni = Math.abs(uniDev) > Math.abs(barterDev)
  const suggestedGate = Math.ceil((shortfallPct + 0.1) * 2) / 2

  if (outlierIsUni) {
    console.log("  Uniswap is the outlier. Widening the gate globally is NOT the right")
    console.log("  fix — it would let bad Uniswap quotes through on every pair. Instead:")
    console.log("")
    console.log("   - Verify the winning fee tier has healthy liquidity (Uniswap analytics).")
    console.log("   - Confirm no recent large swap just moved the tick on this pool.")
    console.log("   - If this pair is chronically thin, route its quote through Barter")
    console.log("     (multi-hop) instead of v3 single-hop in use-swap-quote.")
    console.log("   - If the v3 pool is genuinely broken, block this token pair at the UI")
    console.log("     level until it recovers rather than silently filling at a bad price.")
  } else {
    console.log("  Barter is the outlier. When the cause is small-amount routing overhead")
    console.log("  (extra hops + gas eating a larger share of a small trade), widening the")
    console.log("  gate IS the right fix — it's not a Barter bug. Options:")
    console.log("")
    console.log("  Option A — widen the gate (code change, fastest)")
    console.log("    File  : src/hooks/use-barter-validation.ts:10")
    console.log(`    Change: const MAX_SLIPPAGE_PCT = ${GATE_PCT.toFixed(1)}`)
    console.log(`        to: const MAX_SLIPPAGE_PCT = ${suggestedGate.toFixed(1)}`)
    console.log(`    Effect: allows shortfalls up to ${suggestedGate.toFixed(1)}% (this trade = ${shortfallPct.toFixed(2)}%).`)
    console.log("    Risk  : users accept worse fills on thin-pool routes globally.")
    console.log("")
    console.log("  Option B — promote the gate to Edge Config (recommended)")
    console.log("    1. Add key `barter_max_slippage_pct` to Vercel Edge Config.")
    console.log("    2. Add route src/app/api/config/barter-slippage/route.ts mirroring")
    console.log("       src/app/api/config/quote-guard/route.ts.")
    console.log("    3. Add useBarterSlippageConfig() hook mirroring useQuoteGuardConfig.")
    console.log("    4. Pipe the value into useBarterValidation as a prop, replacing")
    console.log("       the hardcoded MAX_SLIPPAGE_PCT.")
    console.log("    Effect: future incidents resolvable by editing Edge Config — no deploy,")
    console.log("            propagates in ~60s.")
    console.log("")
    console.log("  If Barter's router itself looks degraded (not routing-overhead related):")
    console.log("   - Ask Barter support whether their router is degraded for this pair.")
    console.log("   - Try the raw endpoint: POST https://api2.eth.barterswap.xyz/route")
    console.log("     with the same source/target/sellAmount and confirm the response.")
  }
  console.log("")
}
