import { TransactionReceipt } from "viem"

const RPC_URL = "https://fastrpc.mev-commit.xyz"
const REQUEST_TIMEOUT_MS = 5000
const DEFAULT_MAX_ATTEMPTS = 30
const DEFAULT_INTERVAL_MS = 1000

/**
 * Converts RPC response to viem TransactionReceipt format
 */
function convertRpcResponseToReceipt(data: any): TransactionReceipt {
  return {
    transactionHash: data.result.transactionHash as `0x${string}`,
    transactionIndex: Number(data.result.transactionIndex),
    blockHash: data.result.blockHash as `0x${string}`,
    blockNumber: BigInt(data.result.blockNumber),
    from: data.result.from as `0x${string}`,
    to: data.result.to as `0x${string}` | null,
    cumulativeGasUsed: BigInt(data.result.cumulativeGasUsed),
    gasUsed: BigInt(data.result.gasUsed),
    contractAddress: data.result.contractAddress as `0x${string}` | null,
    logs: (data.result.logs || []).map((log: any) => ({
      address: log.address as `0x${string}`,
      topics: log.topics as readonly `0x${string}`[],
      data: log.data as `0x${string}`,
      blockNumber: BigInt(log.blockNumber || data.result.blockNumber),
      blockHash: (log.blockHash as `0x${string}`) || (data.result.blockHash as `0x${string}`),
      transactionHash:
        (log.transactionHash as `0x${string}`) || (data.result.transactionHash as `0x${string}`),
      transactionIndex: Number(log.transactionIndex || data.result.transactionIndex),
      logIndex: Number(log.logIndex || 0),
      removed: log.removed || false,
    })),
    logsBloom: data.result.logsBloom as `0x${string}`,
    status: data.result.status === "0x1" ? "success" : "reverted",
    type: data.result.type || "0x2",
    effectiveGasPrice: data.result.effectiveGasPrice
      ? BigInt(data.result.effectiveGasPrice)
      : undefined,
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

    if (data.result && data.result.status) {
      return convertRpcResponseToReceipt(data)
    }

    return null
  } catch (error) {
    clearTimeout(timeoutId)
    if (abortSignal?.aborted || (error as Error).name === "AbortError") {
      return null
    }
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
 */
export async function pollDatabaseForReceipt(
  txHash: string,
  abortSignal?: AbortSignal,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  intervalMs: number = DEFAULT_INTERVAL_MS
): Promise<TransactionReceipt | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (abortSignal?.aborted) {
      return null
    }

    try {
      const receipt = await fetchTransactionReceipt(txHash, abortSignal)
      if (receipt) {
        return receipt
      }
    } catch (error) {
      if (abortSignal?.aborted || (error as Error).name === "AbortError") {
        return null
      }
      console.error(`Poll attempt ${attempt + 1} failed:`, error)
    }

    // Wait before next attempt
    if (attempt < maxAttempts - 1) {
      await waitWithAbort(intervalMs, abortSignal)
      if (abortSignal?.aborted) {
        return null
      }
    }
  }

  return null
}

/**
 * Checks if transaction receipt exists in database (for status checks)
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
    throw error
  }
}

/**
 * Polls the database to check if transaction receipt exists
 */
export async function pollDatabaseForStatus(
  hash: string,
  abortSignal?: AbortSignal,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  intervalMs: number = DEFAULT_INTERVAL_MS
): Promise<{ success: boolean; hash: string } | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (abortSignal?.aborted) {
      return null
    }

    try {
      const exists = await checkTransactionReceiptExists(hash, abortSignal)
      if (exists) {
        return { success: true, hash }
      }
    } catch (error) {
      if (abortSignal?.aborted || (error as Error).name === "AbortError") {
        return null
      }
      // Don't log errors for early attempts, only after a few tries
      if (attempt >= 3) {
        console.error(`Status poll attempt ${attempt + 1} failed:`, error)
      }
    }

    // Wait before next attempt
    if (attempt < maxAttempts - 1) {
      await waitWithAbort(intervalMs, abortSignal)
      if (abortSignal?.aborted) {
        return null
      }
    }
  }

  return null
}
