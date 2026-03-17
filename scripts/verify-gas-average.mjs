#!/usr/bin/env node

import { readFileSync } from "fs"

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

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY
if (!ALCHEMY_KEY) { console.error("Missing ALCHEMY_API_KEY"); process.exit(1) }
const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
const CONCURRENCY = 5

// ---------------------------------------------------------------------------
// Step 1: Get 200 recent L1 swap tx hashes from our DB
// ---------------------------------------------------------------------------

console.log("\n--- Step 1: Fetching 200 recent L1 swap tx hashes ---\n")

const hashRes = await fetch("http://localhost:3002/api/analytics/l1-swap-hashes?limit=200")
if (!hashRes.ok) { console.error(`API error (${hashRes.status})`); process.exit(1) }
const hashJson = await hashRes.json()
const hashes = hashJson.hashes
console.log(`Got ${hashes.length} tx hashes`)

// ---------------------------------------------------------------------------
// Step 2: Fetch receipts from Alchemy (gasUsed + effectiveGasPrice)
// ---------------------------------------------------------------------------

console.log("\n--- Step 2: Fetching receipts from Alchemy ---\n")

async function fetchReceipt(txHash) {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getTransactionReceipt", params: [txHash], id: 1 }),
    })
    const data = await res.json()
    if (!data?.result?.gasUsed || !data?.result?.effectiveGasPrice) return null
    return {
      gasUsed: Number(data.result.gasUsed),
      effectiveGasPrice: Number(data.result.effectiveGasPrice),
    }
  } catch { return null }
}

const receipts = []
for (let i = 0; i < hashes.length; i += CONCURRENCY) {
  const chunk = hashes.slice(i, i + CONCURRENCY)
  const results = await Promise.all(chunk.map(fetchReceipt))
  for (const r of results) { if (r) receipts.push(r) }
  process.stdout.write(`  ${Math.min(i + CONCURRENCY, hashes.length)}/${hashes.length}\r`)
}
console.log(`\nSuccessful receipts: ${receipts.length}/${hashes.length}`)

// ---------------------------------------------------------------------------
// Step 3: Compute gasUsed × effectiveGasPrice per tx
// ---------------------------------------------------------------------------

console.log("\n--- Step 3: Results ---\n")

const txData = receipts.map(r => ({
  gasUsed: r.gasUsed,
  effectiveGasPrice: r.effectiveGasPrice,
  totalCost: r.gasUsed * r.effectiveGasPrice,
}))

console.log(`Txs with complete data: ${txData.length}/${receipts.length}`)

console.log("\n=== per-tx breakdown ===")
txData.forEach((t, i) => {
  console.log(`  tx ${String(i + 1).padStart(3)}: gasUsed=${t.gasUsed.toLocaleString().padStart(10)}  effectiveGasPrice=${(t.effectiveGasPrice / 1e9).toFixed(4).padStart(10)} gwei  totalCost=${(t.totalCost / 1e9).toFixed(4).padStart(18)} gwei`)
})

const gasValues = txData.map(t => t.gasUsed).sort((a, b) => a - b)
const gasAvg = Math.round(gasValues.reduce((a, g) => a + g, 0) / gasValues.length)
console.log("\n=== gasUsed (per tx) ===")
console.log(`  Min:      ${gasValues[0].toLocaleString()}`)
console.log(`  Median:   ${gasValues[Math.floor(gasValues.length * 0.5)].toLocaleString()}`)
console.log(`  Mean:     ${gasAvg.toLocaleString()}`)
console.log(`  Max:      ${gasValues[gasValues.length - 1].toLocaleString()}`)

const gasPrices = txData.map(t => t.effectiveGasPrice).sort((a, b) => a - b)
const gpAvg = Math.round(gasPrices.reduce((a, f) => a + f, 0) / gasPrices.length)
console.log("\n=== effectiveGasPrice (baseFee + priorityFee, wei) ===")
console.log(`  Min:      ${gasPrices[0].toLocaleString()} (${(gasPrices[0] / 1e9).toFixed(4)} gwei)`)
console.log(`  Median:   ${gasPrices[Math.floor(gasPrices.length * 0.5)].toLocaleString()} (${(gasPrices[Math.floor(gasPrices.length * 0.5)] / 1e9).toFixed(4)} gwei)`)
console.log(`  Mean:     ${gpAvg.toLocaleString()} (${(gpAvg / 1e9).toFixed(4)} gwei)`)
console.log(`  Max:      ${gasPrices[gasPrices.length - 1].toLocaleString()} (${(gasPrices[gasPrices.length - 1] / 1e9).toFixed(4)} gwei)`)

const costs = txData.map(t => t.totalCost).sort((a, b) => a - b)
const costAvg = Math.round(costs.reduce((a, c) => a + c, 0) / costs.length)
console.log("\n=== gasUsed × effectiveGasPrice (total gas cost per tx, gwei) ===")
console.log(`  Min:      ${(costs[0] / 1e9).toFixed(4)} gwei (${(costs[0] / 1e18).toFixed(8)} ETH)`)
console.log(`  Median:   ${(costs[Math.floor(costs.length * 0.5)] / 1e9).toFixed(4)} gwei (${(costs[Math.floor(costs.length * 0.5)] / 1e18).toFixed(8)} ETH)`)
console.log(`  Mean:     ${(costAvg / 1e9).toFixed(4)} gwei (${(costAvg / 1e18).toFixed(8)} ETH)`)
console.log(`  Max:      ${(costs[costs.length - 1] / 1e9).toFixed(4)} gwei (${(costs[costs.length - 1] / 1e18).toFixed(8)} ETH)`)

console.log(`\n>>> Edge Config value (avg gasUsed × effectiveGasPrice in gwei): ${(costAvg / 1e9).toFixed(4)}`)
