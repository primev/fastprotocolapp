/**
 * FastSettlementV2_1 Contract Constants and ABI
 * @version 2.1.0
 */

import type { Address, Hex } from "viem"

// Contract addresses per network
export const FAST_SETTLEMENT_V2_1_ADDRESSES: Record<number, Address> = {
  1: "0x0000000000000000000000000000000000000000", // Mainnet - TBD
  11155111: "0x0000000000000000000000000000000000000000", // Sepolia - TBD
  17000: "0x0000000000000000000000000000000000000000", // Holesky - TBD
}

// Permit2 canonical addresses
export const PERMIT2_ADDRESSES: Record<number, Address> = {
  1: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  11155111: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  17000: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
}

// EIP-712 Domain for Intent signing
export const FAST_SETTLEMENT_DOMAIN = {
  name: "FastSettlement",
  version: "2.1",
} as const

// Intent typehash for EIP-712 signing
export const INTENT_TYPEHASH =
  "Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint256 deadline,uint256 nonce,bytes32 refId)"

// Witness type string for Permit2
export const WITNESS_TYPE_STRING =
  "Intent witness)Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint256 deadline,uint256 nonce,bytes32 refId)TokenPermissions(address token,uint256 amount)"

/**
 * Intent struct for creating swap intents
 */
export interface Intent {
  maker: Address
  recipient: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  minOut: bigint
  deadline: bigint
  nonce: bigint
  refId: Hex
}

/**
 * Settlement result from contract
 */
export interface SettlementResult {
  intentId: Hex
  success: boolean
  amountOut: bigint
  error: string
}

/**
 * Build EIP-712 typed data for Intent signing
 */
export function buildIntentTypedData(
  intent: Intent,
  chainId: number,
  verifyingContract: Address
) {
  return {
    domain: {
      name: FAST_SETTLEMENT_DOMAIN.name,
      version: FAST_SETTLEMENT_DOMAIN.version,
      chainId: BigInt(chainId),
      verifyingContract,
    },
    types: {
      Intent: [
        { name: "maker", type: "address" },
        { name: "recipient", type: "address" },
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "minOut", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "refId", type: "bytes32" },
      ],
    },
    primaryType: "Intent" as const,
    message: {
      maker: intent.maker,
      recipient: intent.recipient,
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      minOut: intent.minOut,
      deadline: intent.deadline,
      nonce: intent.nonce,
      refId: intent.refId,
    },
  }
}

/**
 * Calculate deadline from minutes offset
 * @param minutes Minutes from now
 * @returns Unix timestamp as bigint
 */
export function calculateDeadline(minutes: number): bigint {
  const now = Math.floor(Date.now() / 1000)
  return BigInt(now + minutes * 60)
}

/**
 * Calculate minOut from amountOut and slippage
 * @param amountOut Expected output amount
 * @param slippagePercent Slippage tolerance as percentage (e.g., 0.5 for 0.5%)
 * @returns Minimum output amount
 */
export function calculateMinOut(amountOut: bigint, slippagePercent: number): bigint {
  const slippageBps = BigInt(Math.floor(slippagePercent * 100))
  return (amountOut * (BigInt(10000) - slippageBps)) / BigInt(10000)
}

/**
 * Generate a random reference ID for intent tracking
 */
export function generateRefId(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex
}

/**
 * FastSettlementV2_1 ABI (key functions only)
 */
export const FAST_SETTLEMENT_V2_1_ABI = [
  // Events
  {
    type: "event",
    name: "IntentSettled",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: false },
      { name: "tokenOut", type: "address", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "minOut", type: "uint256", indexed: false },
      { name: "totalSurplus", type: "uint256", indexed: false },
      { name: "userSurplus", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IntentFailed",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IntentCancelled",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RefundClaimed",
    inputs: [
      { name: "maker", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  // Read functions
  {
    type: "function",
    name: "getIntentId",
    stateMutability: "view",
    inputs: [
      {
        name: "intent",
        type: "tuple",
        components: [
          { name: "maker", type: "address" },
          { name: "recipient", type: "address" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minOut", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "refId", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "isNonceUsed",
    stateMutability: "view",
    inputs: [
      { name: "maker", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getMinNonce",
    stateMutability: "view",
    inputs: [{ name: "maker", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isIntentCancelled",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getPendingRefund",
    stateMutability: "view",
    inputs: [
      { name: "maker", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isSolverAllowed",
    stateMutability: "view",
    inputs: [{ name: "solver", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isRouterAllowed",
    stateMutability: "view",
    inputs: [{ name: "router", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getSurplusRecipient",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getUserSurplusBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isMevProtectionRequired",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getMaxDeadlineOffset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "VERSION",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  // Write functions (for user interactions)
  {
    type: "function",
    name: "cancelIntent",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "intent",
        type: "tuple",
        components: [
          { name: "maker", type: "address" },
          { name: "recipient", type: "address" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minOut", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "refId", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelIntents",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "intents",
        type: "tuple[]",
        components: [
          { name: "maker", type: "address" },
          { name: "recipient", type: "address" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minOut", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "refId", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "invalidateNoncesUpTo",
    stateMutability: "nonpayable",
    inputs: [{ name: "newMinNonce", type: "uint256" }],
    outputs: [],
  },
] as const

/**
 * Permit2 ABI for SignatureTransfer
 */
export const PERMIT2_ABI = [
  {
    type: "function",
    name: "permitTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "permitted",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "transferDetails",
        type: "tuple",
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" },
        ],
      },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "permitWitnessTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "permitted",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "transferDetails",
        type: "tuple",
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" },
        ],
      },
      { name: "owner", type: "address" },
      { name: "witness", type: "bytes32" },
      { name: "witnessTypeString", type: "string" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const

/**
 * Error types from V2.1 contract
 */
export const CONTRACT_ERRORS = {
  UnauthorizedSolver: "UnauthorizedSolver",
  SettlementFailed: "SettlementFailed",
  InsufficientOutput: "InsufficientOutput",
  RouterNotAllowed: "RouterNotAllowed",
  ArrayLengthMismatch: "ArrayLengthMismatch",
  EmptyBatch: "EmptyBatch",
  BatchTooLarge: "BatchTooLarge",
  InvalidSurplusRecipient: "InvalidSurplusRecipient",
  InvalidSurplusBps: "InvalidSurplusBps",
  InvalidRecipient: "InvalidRecipient",
  InvalidPermit2Address: "InvalidPermit2Address",
  InvalidOwnerAddress: "InvalidOwnerAddress",
  InvalidSolverAddress: "InvalidSolverAddress",
  InvalidRouterAddress: "InvalidRouterAddress",
  InvalidNonceIncrement: "InvalidNonceIncrement",
  NonceTooHigh: "NonceTooHigh",
  NoRefundAvailable: "NoRefundAvailable",
  RouterCallFailed: "RouterCallFailed",
  PermitTokenMismatch: "PermitTokenMismatch",
  PermitAmountInsufficient: "PermitAmountInsufficient",
  IntentAlreadyCancelled: "IntentAlreadyCancelled",
  NotIntentMaker: "NotIntentMaker",
  DeadlineTooFar: "DeadlineTooFar",
  ZeroTokenAddress: "ZeroTokenAddress",
  ZeroAmount: "ZeroAmount",
  SameTokenSwap: "SameTokenSwap",
} as const

/**
 * Parse contract error from revert reason
 */
export function parseContractError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message
    for (const [errorName, errorValue] of Object.entries(CONTRACT_ERRORS)) {
      if (message.includes(errorValue)) {
        return errorName
      }
    }
    return message
  }
  return String(error)
}
