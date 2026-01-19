/**
 * Type definitions for swap functionality
 */

export interface Token {
  address: string
  symbol: string
  decimals: number
  logoURI?: string
  name?: string
}

/**
 * SwapIntent interface matching FastSettlementV3 contract
 */
export interface SwapIntent {
  user: `0x${string}`
  inputToken: `0x${string}`
  outputToken: `0x${string}`
  inputAmt: bigint
  userAmtOut: bigint
  recipient: `0x${string}`
  deadline: bigint
  nonce: bigint
}

/**
 * Permit2 TokenPermissions type
 */
export interface TokenPermissions {
  token: `0x${string}`
  amount: bigint
}

/**
 * Permit2 PermitTransferFrom type
 */
export interface PermitTransferFrom {
  permitted: TokenPermissions
  spender: `0x${string}`
  nonce: bigint
  deadline: bigint
}

/**
 * Request body for relay API
 */
export interface RelayRequest {
  signature: string
  intent: SwapIntent
  permit: PermitTransferFrom
}

/**
 * Response from relay API
 */
export interface RelayResponse {
  success: boolean
  message?: string
}
