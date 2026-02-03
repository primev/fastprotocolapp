/**
 * transaction-errors.ts
 */

const MAX_SHORT_MESSAGE_LENGTH = 80

function isViemBaseError(err: unknown): err is { shortMessage: string; message: string } {
  return err != null && typeof err === "object" && "shortMessage" in err
}

function getRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
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
    message.includes("4001") ||
    message.includes("request rejected")
  )
}

export function getTransactionErrorMessage(
  error: unknown,
  operation: string = "transaction"
): string {
  if (!error) return "Transaction failed"
  if (isTransactionRejection(error)) return "Transaction Cancelled in Wallet"

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()

  // Centralized RPC/Network troubleshooting block
  if (
    message.includes("failed to fetch") ||
    message.includes("rpc") ||
    message.includes("endpoint") ||
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "Network error: Unable to connect to the blockchain. Please check your internet connection, RPC endpoint settings, or try switching networks in your wallet."
  }

  if (message.includes("insufficient funds")) return "Insufficient funds for gas fees"
  if (message.includes("deadline") || message.includes("expired"))
    return "Transaction deadline expired"
  if (message.includes("insufficient balance")) return "Insufficient balance"

  return error instanceof Error ? error.message : String(error)
}

export function getTransactionErrorTitle(
  error: unknown,
  operation: string = "transaction"
): string {
  if (isTransactionRejection(error)) {
    return `${operation.charAt(0).toUpperCase() + operation.slice(1)} Cancelled`
  }
  return `${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed`
}

/**
 * Returns a concise 1-line message for inline display (e.g. status view).
 * Uses known pattern mappings, viem shortMessage when available, or truncates.
 */
export function getTransactionShortMessage(error: unknown): string {
  if (!error) return "Transaction failed"
  if (isTransactionRejection(error)) return "Transaction Cancelled in Wallet"

  const message = getRawMessage(error).toLowerCase()

  // Known patterns – concise short messages
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
  if (message.includes("deadline") || message.includes("expired"))
    return "Transaction deadline expired"
  if (message.includes("insufficient balance")) return "Insufficient balance"

  // Viem BaseError – use shortMessage when available
  if (isViemBaseError(error) && error.shortMessage) {
    const short = error.shortMessage.trim()
    if (short.length <= MAX_SHORT_MESSAGE_LENGTH) return short
    const firstLine = short.split("\n")[0]?.trim() ?? short
    return firstLine.length <= MAX_SHORT_MESSAGE_LENGTH
      ? firstLine
      : `${firstLine.slice(0, MAX_SHORT_MESSAGE_LENGTH - 3)}...`
  }

  // Fallback: first sentence or truncate
  const raw = getRawMessage(error)
  const firstSentence = raw.split(/[.!?]/)[0]?.trim()
  const toTruncate = firstSentence && firstSentence.length < raw.length ? firstSentence : raw
  if (toTruncate.length <= MAX_SHORT_MESSAGE_LENGTH) return toTruncate
  return `${toTruncate.slice(0, MAX_SHORT_MESSAGE_LENGTH - 3)}...`
}

/**
 * Returns the full error string for the details modal and copy.
 * Includes viem Details, revert data, and optionally traverses cause chain.
 */
export function getTransactionFullMessage(error: unknown): string {
  if (!error) return "No error details available."
  if (error instanceof Error) {
    const parts: string[] = [error.message]
    let cause: unknown = error.cause
    while (cause instanceof Error && cause.message) {
      parts.push(`\n\nCause: ${cause.message}`)
      cause = cause.cause
    }
    return parts.join("")
  }
  return String(error)
}
