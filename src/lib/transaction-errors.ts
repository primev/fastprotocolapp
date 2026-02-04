/**
 * transaction-errors.ts
 */

const MAX_SHORT_MESSAGE_LENGTH = 80

/**
 * Shared logic to map complex error strings to human-readable summaries.
 */
function mapErrorMessage(error: unknown): string | null {
  if (!error) return null
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()

  if (isTransactionRejection(error)) return "Transaction Cancelled in Wallet"

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

/**
 * Returns the full error string including the cause chain.
 */
export function getTransactionFullMessage(error: unknown): string {
  if (!error) return "No error details available."

  const parts: string[] = []
  let current: unknown = error

  while (current) {
    if (current instanceof Error) {
      parts.push(current.message)
      current = current.cause
    } else {
      parts.push(String(current))
      break
    }
  }

  return parts.join("\n\nCause: ")
}
