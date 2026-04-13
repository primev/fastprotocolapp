#!/usr/bin/env node
/**
 * Shrink the barter-supported tokens JSON:
 *   - Drop sentinel native-ETH addresses (0x00..00, 0xee..ee)
 *   - Drop the `prices` field (we use CoinGecko at runtime instead)
 *   - Keep only { address, tokenInfo: { name, symbol, decimals } }
 *   - Lowercase all keys so the runtime loader doesn't have to
 *   - Skip entries missing required ERC-20 fields (symbol, decimals)
 *
 * Reads + writes public/data/barter-supported-tokens.json in place.
 * Run: node scripts/shrink-barter-tokens.mjs
 */

import { readFileSync, writeFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = join(__dirname, "..", "public", "data", "barter-supported-tokens.json")

const NATIVE_SENTINELS = new Set([
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
])

const beforeBytes = statSync(FILE).size
const raw = JSON.parse(readFileSync(FILE, "utf8"))

const shrunk = {}
let dropped = 0
let kept = 0
for (const key of Object.keys(raw)) {
  const entry = raw[key]
  const addr = (entry?.address ?? key).toLowerCase()
  if (NATIVE_SENTINELS.has(addr)) {
    dropped++
    continue
  }
  const info = entry?.tokenInfo
  if (!info || !info.symbol || info.decimals == null) {
    dropped++
    continue
  }
  shrunk[addr] = {
    address: addr,
    tokenInfo: {
      name: info.name || info.symbol,
      symbol: info.symbol,
      decimals: Number(info.decimals),
    },
  }
  kept++
}

writeFileSync(FILE, JSON.stringify(shrunk) + "\n")
const afterBytes = statSync(FILE).size

const mb = (n) => (n / 1024 / 1024).toFixed(2) + " MB"
console.log(`barter-supported-tokens.json`)
console.log(`  before: ${mb(beforeBytes)}`)
console.log(`  after:  ${mb(afterBytes)}`)
console.log(`  kept:   ${kept}`)
console.log(`  dropped:${dropped}`)
