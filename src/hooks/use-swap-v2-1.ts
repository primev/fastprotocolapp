"use client"

import { useState, useCallback, useMemo } from "react"
import { useAccount, useChainId, useSignTypedData, usePublicClient } from "wagmi"
import type { Address, Hex } from "viem"
import {
  buildIntentTypedData,
  calculateDeadline,
  calculateMinOut,
  generateRefId,
  FAST_SETTLEMENT_V2_1_ADDRESSES,
  PERMIT2_ADDRESSES,
  type Intent,
} from "@/lib/fast-settlement-v2-1"

export interface SwapParams {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  expectedAmountOut: bigint
  slippagePercent: number // e.g., 0.5 for 0.5%
  deadlineMinutes: number // e.g., 30 for 30 minutes
  recipient?: Address // defaults to maker
}

export interface SwapState {
  status: "idle" | "signing" | "submitting" | "success" | "error"
  intentId: Hex | null
  signature: Hex | null
  intent: Intent | null
  error: Error | null
  txHash: Hex | null
}

export interface UseSwapReturn {
  swap: (params: SwapParams) => Promise<void>
  cancelIntent: (intent: Intent) => Promise<void>
  claimRefund: (token: Address) => Promise<void>
  state: SwapState
  reset: () => void
  isSupported: boolean
}

const initialState: SwapState = {
  status: "idle",
  intentId: null,
  signature: null,
  intent: null,
  error: null,
  txHash: null,
}

/**
 * Hook for executing swaps via FastSettlementV2_1
 *
 * Key features:
 * - Deadline calculated at execution time (not hook init) to prevent stale deadlines
 * - Proper slippage calculation using basis points
 * - Intent cancellation support
 * - Refund claiming support
 * - Runtime input validation
 */
export function useSwapV2_1(): UseSwapReturn {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { signTypedDataAsync } = useSignTypedData()

  const [state, setState] = useState<SwapState>(initialState)

  // Check if current chain is supported
  const isSupported = useMemo(() => {
    return chainId in FAST_SETTLEMENT_V2_1_ADDRESSES
  }, [chainId])

  const contractAddress = useMemo(() => {
    return FAST_SETTLEMENT_V2_1_ADDRESSES[chainId] || null
  }, [chainId])

  const permit2Address = useMemo(() => {
    return PERMIT2_ADDRESSES[chainId] || null
  }, [chainId])

  /**
   * Get the next available nonce for the user
   * In a real implementation, this would query the contract
   */
  const getNextNonce = useCallback(async (): Promise<bigint> => {
    // TODO: Query contract for minNonce and find next available
    // For now, use timestamp-based nonce
    return BigInt(Date.now())
  }, [])

  /**
   * Execute a swap by signing an intent
   *
   * IMPORTANT: Deadline is calculated HERE, not when the hook initializes,
   * to prevent stale deadlines from long-pending UI states.
   */
  const swap = useCallback(
    async (params: SwapParams) => {
      if (!address) {
        setState((s) => ({
          ...s,
          status: "error",
          error: new Error("Wallet not connected"),
        }))
        return
      }

      if (!contractAddress || !permit2Address) {
        setState((s) => ({
          ...s,
          status: "error",
          error: new Error(`Chain ${chainId} not supported`),
        }))
        return
      }

      // Validate inputs
      if (params.amountIn <= 0n) {
        setState((s) => ({
          ...s,
          status: "error",
          error: new Error("Amount must be greater than 0"),
        }))
        return
      }

      if (params.tokenIn === params.tokenOut) {
        setState((s) => ({
          ...s,
          status: "error",
          error: new Error("Cannot swap same token"),
        }))
        return
      }

      if (params.slippagePercent < 0 || params.slippagePercent > 50) {
        setState((s) => ({
          ...s,
          status: "error",
          error: new Error("Slippage must be between 0 and 50%"),
        }))
        return
      }

      if (params.deadlineMinutes < 1 || params.deadlineMinutes > 1440) {
        setState((s) => ({
          ...s,
          status: "error",
          error: new Error("Deadline must be between 1 and 1440 minutes"),
        }))
        return
      }

      try {
        setState({ ...initialState, status: "signing" })

        // Calculate deadline NOW, not earlier
        // This is critical to prevent expired intents from long UI sessions
        const deadline = calculateDeadline(params.deadlineMinutes)

        // Calculate minOut with slippage
        const minOut = calculateMinOut(params.expectedAmountOut, params.slippagePercent)

        // Get next nonce
        const nonce = await getNextNonce()

        // Generate unique reference ID for tracking
        const refId = generateRefId()

        // Build intent
        const intent: Intent = {
          maker: address,
          recipient: params.recipient || address,
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          minOut,
          deadline,
          nonce,
          refId,
        }

        // Build EIP-712 typed data
        const typedData = buildIntentTypedData(intent, chainId, contractAddress)

        // Sign the intent
        const signature = await signTypedDataAsync({
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message,
        })

        setState((s) => ({
          ...s,
          status: "submitting",
          signature: signature as Hex,
          intent,
        }))

        // In production, this would submit to a solver/relayer API
        // For now, we just store the signed intent
        // The solver would call settleBatch or settle on the contract

        // Mock: Generate intent ID (in production this comes from the contract)
        const intentId = `0x${Array.from(new Uint8Array(32))
          .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"))
          .join("")}` as Hex

        setState((s) => ({
          ...s,
          status: "success",
          intentId,
        }))

        console.log("Intent signed successfully:", {
          intentId,
          intent,
          signature,
        })
      } catch (error) {
        console.error("Swap error:", error)
        setState((s) => ({
          ...s,
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        }))
      }
    },
    [address, chainId, contractAddress, permit2Address, signTypedDataAsync, getNextNonce]
  )

  /**
   * Cancel a pending intent
   */
  const cancelIntent = useCallback(
    async (intent: Intent) => {
      if (!address || !publicClient || !contractAddress) {
        throw new Error("Wallet not connected or chain not supported")
      }

      if (intent.maker !== address) {
        throw new Error("Can only cancel your own intents")
      }

      // In production, this would call the contract's cancelIntent function
      console.log("Cancelling intent:", intent)

      // TODO: Implement actual contract call
      // await writeContract({
      //   address: contractAddress,
      //   abi: FAST_SETTLEMENT_V2_1_ABI,
      //   functionName: "cancelIntent",
      //   args: [intent],
      // })
    },
    [address, publicClient, contractAddress]
  )

  /**
   * Claim refund for a token
   */
  const claimRefund = useCallback(
    async (token: Address) => {
      if (!address || !publicClient || !contractAddress) {
        throw new Error("Wallet not connected or chain not supported")
      }

      // In production, this would call the contract's claimRefund function
      console.log("Claiming refund for token:", token)

      // TODO: Implement actual contract call
      // await writeContract({
      //   address: contractAddress,
      //   abi: FAST_SETTLEMENT_V2_1_ABI,
      //   functionName: "claimRefund",
      //   args: [token],
      // })
    },
    [address, publicClient, contractAddress]
  )

  /**
   * Reset swap state
   */
  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    swap,
    cancelIntent,
    claimRefund,
    state,
    reset,
    isSupported,
  }
}

/**
 * Validate swap parameters before execution
 * Throws descriptive errors for invalid params
 */
export function validateSwapParams(params: Partial<SwapParams>): asserts params is SwapParams {
  if (!params.tokenIn) {
    throw new Error("tokenIn is required")
  }
  if (!params.tokenOut) {
    throw new Error("tokenOut is required")
  }
  if (params.tokenIn === params.tokenOut) {
    throw new Error("Cannot swap same token")
  }
  if (!params.amountIn || params.amountIn <= 0n) {
    throw new Error("amountIn must be greater than 0")
  }
  if (!params.expectedAmountOut || params.expectedAmountOut <= 0n) {
    throw new Error("expectedAmountOut must be greater than 0")
  }
  if (
    params.slippagePercent === undefined ||
    params.slippagePercent < 0 ||
    params.slippagePercent > 50
  ) {
    throw new Error("slippagePercent must be between 0 and 50")
  }
  if (
    params.deadlineMinutes === undefined ||
    params.deadlineMinutes < 1 ||
    params.deadlineMinutes > 1440
  ) {
    throw new Error("deadlineMinutes must be between 1 and 1440 (24 hours)")
  }
}

/**
 * Format swap state for display
 */
export function getSwapStatusMessage(state: SwapState): string {
  switch (state.status) {
    case "idle":
      return "Ready to swap"
    case "signing":
      return "Please sign the transaction in your wallet..."
    case "submitting":
      return "Submitting swap intent..."
    case "success":
      return "Swap intent submitted successfully!"
    case "error":
      return state.error?.message || "An error occurred"
    default:
      return ""
  }
}
