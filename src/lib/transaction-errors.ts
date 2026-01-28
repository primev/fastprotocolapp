/**
 * Transaction error handling utilities
 * Centralized functions for detecting and formatting transaction errors
 */

/**
 * Check if an error is a user rejection/cancellation of a transaction
 * @param error - The error object to check
 * @returns true if the error indicates user rejection
 */
export function isTransactionRejection(error: unknown): boolean {
  if (!error) return false

  const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase() || ""

  return (
    errorMessage.includes("rejected") ||
    errorMessage.includes("user rejected") ||
    errorMessage.includes("user denied") ||
    errorMessage.includes("user cancelled") ||
    errorMessage.includes("user canceled") ||
    errorMessage.includes("4001") || // MetaMask rejection code
    errorMessage.includes("action_cancelled") ||
    errorMessage.includes("action_canceled") ||
    errorMessage.includes("request rejected") ||
    errorMessage.includes("transaction was rejected")
  )
}

/**
 * Get a clean, user-friendly message for transaction rejections
 * @param operation - The operation type (e.g., "swap", "wrap", "unwrap")
 * @returns A clean rejection message
 */
export function getTransactionRejectionMessage(operation: string = "transaction"): string {
  return `${operation.charAt(0).toUpperCase() + operation.slice(1)} cancelled`
}

/**
 * Get a user-friendly error message for transaction errors
 * Handles various error types including rejections, network errors, insufficient funds, etc.
 * @param error - The error object
 * @param operation - The operation type (e.g., "swap", "wrap", "unwrap")
 * @returns A user-friendly error message
 */
export function getTransactionErrorMessage(
  error: unknown,
  operation: string = "transaction"
): string {
  if (!error) return "Transaction failed"

  const isRejection = isTransactionRejection(error)

  if (isRejection) {
    return "You cancelled the transaction"
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes("insufficient funds")) {
      return "Insufficient funds for gas fees"
    }

    if (message.includes("network") || message.includes("connection")) {
      return "Network error. Please check your connection and try again"
    }

    if (message.includes("deadline") || message.includes("expired")) {
      return "Transaction deadline expired. Please try again"
    }

    if (message.includes("insufficient balance")) {
      return "Insufficient balance"
    }

    if (message.includes("timeout") || message.includes("time out")) {
      return "Request timed out. Please try again"
    }

    if (message.includes("failed to fetch")) {
      return "Check your RPC endpoint and try again"
    }

    // Return original message if no specific pattern matches
    return error.message
  }

  return String(error) || "Transaction failed"
}

/**
 * Get a user-friendly title for transaction errors
 * @param error - The error object
 * @param operation - The operation type (e.g., "swap", "wrap", "unwrap")
 * @returns A user-friendly error title
 */
export function getTransactionErrorTitle(
  error: unknown,
  operation: string = "transaction"
): string {
  if (isTransactionRejection(error)) {
    return getTransactionRejectionMessage(operation)
  }

  const capitalizedOperation = operation.charAt(0).toUpperCase() + operation.slice(1)

  return `${capitalizedOperation} Failed`
}
