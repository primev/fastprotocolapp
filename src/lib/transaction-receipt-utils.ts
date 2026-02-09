import { TransactionReceipt } from "viem"

const RPC_URL = "https://fastrpc.mev-commit.xyz"
const REQUEST_TIMEOUT_MS = 5000
const DEFAULT_MAX_ATTEMPTS = 30
const DEFAULT_INTERVAL_MS = 1000

/**
 * Converts RPC response to viem TransactionReceipt format
 * Throws an error if the receipt doesn't have a valid block number
 */
function convertRpcResponseToReceipt(data: any): TransactionReceipt {
  const result = data.result

  return {
    transactionHash: result.transactionHash as `0x${string}`,
    transactionIndex: Number(result.transactionIndex),
    blockHash: result.blockHash as `0x${string}`,
    blockNumber: BigInt(result.blockNumber),
    from: result.from as `0x${string}`,
    to: result.to as `0x${string}` | null,
    cumulativeGasUsed: BigInt(result.cumulativeGasUsed),
    gasUsed: BigInt(result.gasUsed),
    contractAddress: result.contractAddress as `0x${string}` | null,
    logs: (result.logs || []).map((log: any) => ({
      address: log.address as `0x${string}`,
      topics: log.topics as readonly `0x${string}`[],
      data: log.data as `0x${string}`,
      blockNumber: BigInt(log.blockNumber || result.blockNumber),
      blockHash: (log.blockHash as `0x${string}`) || (result.blockHash as `0x${string}`),
      transactionHash:
        (log.transactionHash as `0x${string}`) || (result.transactionHash as `0x${string}`),
      transactionIndex: Number(log.transactionIndex || result.transactionIndex),
      logIndex: Number(log.logIndex || 0),
      removed: log.removed || false,
    })),
    logsBloom: result.logsBloom as `0x${string}`,
    status: result.status === "0x1" ? "success" : "reverted",
    type: result.type || "0x2",
    effectiveGasPrice: result.effectiveGasPrice ? BigInt(result.effectiveGasPrice) : undefined,
  }
}

/**
 * Makes a single RPC call to get transaction receipt
 */
async function fetchTransactionReceipt(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<TransactionReceipt | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txHash],
        id: 1,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (abortSignal?.aborted) {
      return null
    }

    const data = await response.json()

    // No result means transaction not found in DB yet
    if (!data.result) {
      // This is normal - DB hasn't indexed the transaction yet
      return null
    }

    // Has result but no status means pending/not confirmed
    if (!data.result.status) {
      console.log(`[fetchTransactionReceipt] Receipt found but no status (pending) for ${txHash}`)
      return null
    }

    // Has status - convert to receipt (will throw if no block number/hash)
    return convertRpcResponseToReceipt(data)
  } catch (error) {
    clearTimeout(timeoutId)
    if (abortSignal?.aborted || (error as Error).name === "AbortError") {
      return null
    }
    // Propagate all errors - including "no block number/hash" errors
    throw error
  }
}

/**
 * Waits for a specified interval, respecting abort signal
 */
async function waitWithAbort(intervalMs: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, intervalMs)
    abortSignal?.addEventListener("abort", () => {
      clearTimeout(timeout)
      resolve(undefined)
    })
  })
}

/**
 * Polls the database RPC endpoint for transaction receipt
 * Throws an error if receipt exists without block number/hash
 * Returns the receipt when found, or null if aborted/max attempts reached
 */
export async function pollDatabaseForReceipt(
  txHash: string,
  abortSignal?: AbortSignal,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  intervalMs: number = DEFAULT_INTERVAL_MS
): Promise<TransactionReceipt | null> {
  console.log(`[pollDatabaseForReceipt] Starting polling for ${txHash}`)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (abortSignal?.aborted) {
      console.log(`[pollDatabaseForReceipt] Aborted at attempt ${attempt + 1}`)
      return null
    }

    try {
      const receipt = await fetchTransactionReceipt(txHash, abortSignal)
      if (receipt) {
        console.log(`[pollDatabaseForReceipt] ✅ Found valid receipt on attempt ${attempt + 1}`)
        return receipt
      }
      // Only log every 5 attempts to avoid spam
      if (attempt % 5 === 0 && attempt > 0) {
        console.log(
          `[pollDatabaseForReceipt] Still waiting... (attempt ${attempt + 1}/${maxAttempts})`
        )
      }
    } catch (error) {
      if (abortSignal?.aborted || (error as Error).name === "AbortError") {
        console.log(`[pollDatabaseForReceipt] Aborted during error handling`)
        return null
      }

      const errorMsg = (error as Error).message

      // If the error is about missing block number/hash, throw it immediately
      // This is a fatal error - the transaction failed to be included in a block
      if (errorMsg.includes("no block number") || errorMsg.includes("no block hash")) {
        console.error(`[pollDatabaseForReceipt] ❌ Fatal error - receipt without block:`, error)
        throw error
      }

      // For other errors, log and continue trying
      console.error(`[pollDatabaseForReceipt] Poll attempt ${attempt + 1} failed:`, error)
    }

    // Wait before next attempt
    if (attempt < maxAttempts - 1) {
      await waitWithAbort(intervalMs, abortSignal)
      if (abortSignal?.aborted) {
        console.log(`[pollDatabaseForReceipt] Aborted during wait`)
        return null
      }
    }
  }

  console.warn(`[pollDatabaseForReceipt] ⏱️ Max attempts (${maxAttempts}) reached for ${txHash}`)
  return null
}

/**
 * Fetches transaction receipt from DB (single request).
 * Returns receipt with status, or null if not found/pending.
 * Use this when you need to check receipt.status (e.g. 0x0 = failed).
 */
export async function fetchTransactionReceiptFromDb(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<TransactionReceipt | null> {
  return fetchTransactionReceipt(txHash, abortSignal)
}

/**
 * Checks if transaction receipt exists in database (for status checks)
 * Returns true only if receipt exists with a valid block number/hash
 * Throws an error if receipt exists without block number/hash
 */
export async function checkTransactionReceiptExists(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<boolean> {
  try {
    const receipt = await fetchTransactionReceipt(txHash, abortSignal)
    return receipt !== null
  } catch (error) {
    if (abortSignal?.aborted || (error as Error).name === "AbortError") {
      return false
    }
    // Propagate the error (including "no block number/hash" errors)
    throw error
  }
}

/**
 * Polls the database to check if transaction receipt exists
 * Throws an error if receipt exists without block number/hash
 * Returns status object when found, or null if aborted/max attempts reached
 */
export async function pollDatabaseForStatus(
  hash: string,
  abortSignal?: AbortSignal,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  intervalMs: number = DEFAULT_INTERVAL_MS
): Promise<{ success: boolean; hash: string } | null> {
  console.log(`[pollDatabaseForStatus] Starting polling for ${hash}`)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (abortSignal?.aborted) {
      console.log(`[pollDatabaseForStatus] Aborted at attempt ${attempt + 1}`)
      return null
    }

    try {
      const exists = await checkTransactionReceiptExists(hash, abortSignal)
      if (exists) {
        console.log(`[pollDatabaseForStatus] ✅ Found valid receipt on attempt ${attempt + 1}`)
        return { success: true, hash }
      }
      // Only log every 5 attempts to avoid spam
      if (attempt % 5 === 0 && attempt > 0) {
        console.log(
          `[pollDatabaseForStatus] Still waiting... (attempt ${attempt + 1}/${maxAttempts})`
        )
      }
    } catch (error) {
      if (abortSignal?.aborted || (error as Error).name === "AbortError") {
        console.log(`[pollDatabaseForStatus] Aborted during error handling`)
        return null
      }

      const errorMsg = (error as Error).message

      // If the error is about missing block number/hash, throw it immediately
      // This is a fatal error - the transaction failed to be included in a block
      if (errorMsg.includes("no block number") || errorMsg.includes("no block hash")) {
        console.error(`[pollDatabaseForStatus] ❌ Fatal error - receipt without block:`, error)
        throw error
      }

      // For other errors, don't log for early attempts, only after a few tries
      if (attempt >= 3) {
        console.error(`[pollDatabaseForStatus] Status poll attempt ${attempt + 1} failed:`, error)
      }
    }

    // Wait before next attempt
    if (attempt < maxAttempts - 1) {
      await waitWithAbort(intervalMs, abortSignal)
      if (abortSignal?.aborted) {
        console.log(`[pollDatabaseForStatus] Aborted during wait`)
        return null
      }
    }
  }

  console.warn(`[pollDatabaseForStatus] ⏱️ Max attempts (${maxAttempts}) reached for ${hash}`)
  return null
}
