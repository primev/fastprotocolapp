/**
 * transaction-errors.ts
 */

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
