import { TransactionReceipt } from "viem"

const RPC_URL = "https://fastrpc.mev-commit.xyz"
const REQUEST_TIMEOUT_MS = 5000

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

export type TransactionReceiptFromDb = {
  receipt: TransactionReceipt
  /** Raw RPC result (data.result) as returned by the DB, unmodified. */
  rawResult: unknown
}

/**
 * Makes a single RPC call to get transaction receipt.
 * Returns both the converted viem receipt and the raw RPC result for display.
 */
async function fetchTransactionReceipt(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<TransactionReceiptFromDb | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // Link parent abort signal so in-flight requests cancel immediately
  if (abortSignal) {
    if (abortSignal.aborted) {
      clearTimeout(timeoutId)
      return null
    }
    abortSignal.addEventListener("abort", () => controller.abort(), { once: true })
  }

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
    const receipt = convertRpcResponseToReceipt(data)
    return { receipt, rawResult: data.result }
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
 * Fetches transaction receipt from DB (single request).
 * Returns receipt + raw RPC result when found, or null if not found/pending.
 * Use this when you need to check receipt.status (e.g. 0x0 = failed).
 */
export async function fetchTransactionReceiptFromDb(
  txHash: string,
  abortSignal?: AbortSignal
): Promise<TransactionReceiptFromDb | null> {
  return fetchTransactionReceipt(txHash, abortSignal)
}
