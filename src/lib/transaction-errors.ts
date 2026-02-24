/**
 * transaction-errors.ts
 */

import type { TransactionReceipt } from "viem"

/**
 * Parses a barter minReturn error to compute the minimum required slippage.
 * Matches: "barter minReturn (1987949) < user required (2000000)"
 *
 * The error context also includes the current slippage ("Slippage: 0.5"), which we use
 * to reconstruct the original Uniswap amountOut from the already-slippage-adjusted
 * userRequired. This gives an accurate recommendation regardless of whether the failing
 * swap was exactIn or exactOut.
 */
export function parseBarterSlippageError(message: string): {
  barterMinReturn: number
  userRequired: number
  recommendedSlippage: string
} | null {
  const match = message.match(/barter\s+minReturn\s*\((\d+)\)\s*<\s*user\s+required\s*\((\d+)\)/i)
  if (!match) return null
  const barterMinReturn = parseInt(match[1])
  const userRequired = parseInt(match[2])
  if (isNaN(barterMinReturn) || isNaN(userRequired) || userRequired <= 0) return null

  // Parse the current slippage from the context block ("Slippage: 0.5")
  const slippageMatch = message.match(/Slippage:\s*([\d.]+)/i)
  const currentSlippage = slippageMatch ? parseFloat(slippageMatch[1]) : 0

  // Reconstruct the original Uniswap amountOut before slippage was applied.
  // userRequired = amountOut * (1 - currentSlippage/100), so:
  const slippageFactor = 1 - currentSlippage / 100
  const amountOut = slippageFactor > 0 ? userRequired / slippageFactor : userRequired

  // Required slippage = how far barterMinReturn falls short of the original quote
  const requiredSlippagePct = ((amountOut - barterMinReturn) / amountOut) * 100
  // Round up to nearest 0.1%, add 0.1% safety buffer, cap at 2.0%
  const recommended = Math.min(2.0, Math.ceil(requiredSlippagePct * 10) / 10 + 0.1)
  return { barterMinReturn, userRequired, recommendedSlippage: recommended.toFixed(1) }
}

const MAX_SHORT_MESSAGE_LENGTH = 80

/**
 * Error for failed transactions (status 0x0).
 * The receipt is attached as cause for extended error details.
 * When failure was detected from DB, rawDbRecord holds the unmodified RPC result.
 */
export class RPCError extends Error {
  constructor(
    message: string,
    public readonly receipt?: TransactionReceipt,
    /** Raw RPC result from DB (data.result), when failure was detected from DB poll. */
    public readonly rawDbRecord?: unknown
  ) {
    super(message)
    this.name = "RPCError"
    if (receipt) {
      this.cause = receipt
    }
  }
}

/**
 * Shared logic to map complex error strings to human-readable summaries.
 */
function mapErrorMessage(error: unknown): string | null {
  if (!error) return null
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()

  if (isTransactionRejection(error)) return "Transaction Cancelled in Wallet"

  // Barter-specific errors (check before generic network/fetch)
  if (message.includes("barter api error")) return "Barter routing failed. Please try again."
  if (message.includes("barter") && (message.includes("api") || message.includes("route"))) {
    return "Barter API error. Please check your connection."
  }
  if (message.includes("no route") || message.includes("route not found")) {
    return "No route found for this swap."
  }
  if (
    (message.includes("401") ||
      message.includes("unauthorized") ||
      message.includes("api_key") ||
      message.includes("authorization")) &&
    (message.includes("barter") || message.includes("api key"))
  ) {
    return "Barter API key invalid or missing."
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("rpc") ||
    message.includes("endpoint") ||
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "Network error"
  }

  if (message.includes("insufficient funds")) return "Insufficient funds for gas fees"
  if (message.includes("insufficient balance")) return "Insufficient balance"

  if (message.includes("deadline")) {
    const parts = message.split("deadline: ")
    if (parts.length > 1) {
      const deadline = parseInt(parts[1])
      if (!isNaN(deadline) && deadline < Math.floor(Date.now() / 1000)) {
        return "Transaction deadline expired"
      }
    }
    if (message.includes("expired")) return "Transaction deadline expired"
  }

  return null
}

export function isTransactionRejection(error: unknown): boolean {
  if (!error) return false
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    message.includes("rejected") ||
    message.includes("user rejected") ||
    message.includes("denied") ||
    message.includes("cancelled") ||
    message.includes("canceled") ||
    message.includes("4001")
  )
}

export function getTransactionErrorMessage(error: unknown): string {
  if (!error) return "Transaction failed"

  const mapped = mapErrorMessage(error)
  if (mapped) {
    return mapped === "Network error"
      ? "Network error: Unable to connect to the blockchain. Please check your internet connection or RPC settings."
      : mapped
  }

  return error instanceof Error ? error.message : String(error)
}

export function getTransactionErrorTitle(
  error: unknown,
  operation: string = "transaction"
): string {
  const prefix = operation.charAt(0).toUpperCase() + operation.slice(1)
  return isTransactionRejection(error) ? `${prefix} Cancelled` : `${prefix} Failed`
}

/**
 * Returns a concise 1-line message for status displays.
 */
export function getTransactionShortMessage(error: unknown): string {
  if (!error) return "Transaction failed"

  const mapped = mapErrorMessage(error)
  if (mapped) return mapped

  // Handle Viem/Wagmi BaseError shortMessage
  if (error != null && typeof error === "object" && "shortMessage" in error) {
    const short = String((error as any).shortMessage)
      .trim()
      .split("\n")[0]
    return short.length <= MAX_SHORT_MESSAGE_LENGTH
      ? short
      : `${short.slice(0, MAX_SHORT_MESSAGE_LENGTH - 3)}...`
  }

  // Fallback: sentence truncation
  const raw = error instanceof Error ? error.message : String(error)
  const firstSentence = raw.split(/[.!?]/)[0]?.trim() || raw
  return firstSentence.length <= MAX_SHORT_MESSAGE_LENGTH
    ? firstSentence
    : `${firstSentence.slice(0, MAX_SHORT_MESSAGE_LENGTH - 3)}...`
}

function stringifyErrorValue(value: unknown): string {
  if (value instanceof Error) return value.message
  if (value != null && typeof value === "object") {
    if ("message" in value && typeof (value as { message?: unknown }).message === "string") {
      return (value as { message: string }).message
    }
    if ("details" in value && typeof (value as { details?: unknown }).details === "string") {
      return (value as { details: string }).details
    }
    try {
      return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/**
 * Returns the full error string including the cause chain.
 * Deduplicates: skips cause messages that are already contained in the output,
 * so Viem-style errors (where the top message already includes cause info) don't repeat.
 */
export function getTransactionFullMessage(error: unknown): string {
  if (!error) return "No error details available."

  const parts: string[] = []
  let current: unknown = error
  let accumulated = ""

  while (current) {
    let msg: string
    if (current instanceof Error) {
      msg = current.message
      current = current.cause
    } else {
      msg = stringifyErrorValue(current)
      current = null
    }

    const trimmed = msg.trim()
    if (trimmed && !accumulated.includes(trimmed)) {
      parts.push(msg)
      accumulated += msg
    }
  }

  return parts.length > 0 ? parts.join("\n\nCause: ") : "No error details available."
}
