/**
 * Fetches stablecoin symbols from CoinGecko and writes a deduplicated list to src/lib/stablecoin-list.json.
 * Run: npx tsx scripts/getStablecoins.ts
 */

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=stablecoins"
const OUT_PATH = new URL("../src/lib/stablecoin-list.json", import.meta.url)

interface CoinGeckoItem {
  symbol: string
  [key: string]: unknown
}

async function main() {
  const res = await fetch(COINGECKO_URL)
  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as CoinGeckoItem[]
  const symbols = [...new Set(data.map((item) => item.symbol.toUpperCase()))].sort()
  const json = JSON.stringify(symbols, null, 2)
  const { writeFileSync, mkdirSync } = await import("fs")
  const { dirname } = await import("path")
  const { fileURLToPath } = await import("url")
  const outPath = fileURLToPath(OUT_PATH)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, json + "\n", "utf8")
  console.log(`Wrote ${symbols.length} stablecoin symbols to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
