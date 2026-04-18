"use client"

import { useCallback } from "react"
import { useSignTypedData, useAccount, useChainId } from "wagmi"
import { parseUnits } from "viem"
import {
  PERMIT2_ADDRESS,
  FAST_SETTLEMENT_ADDRESS,
  INTENT_DEADLINE_MINUTES,
} from "@/lib/swap/constants"
import { INTENT_WITNESS_TYPE_STRING, GET_SWAP_INTENT_TYPES } from "@/lib/swap/permit2-utils"
import type { SwapIntent, PermitTransferFrom } from "@/types/swap"

/**
 * Hook for generating EIP-712 signatures for Permit2 witness transfers.
 * This allows users to sign a swap intent that a filler can execute.
 */
export function useSwapIntent() {
  const { signTypedDataAsync } = useSignTypedData()
  const { address } = useAccount()
  const chainId = useChainId()

  const createIntentSignature = useCallback(
    async (
      tokenIn: `0x${string}`,
      tokenOut: `0x${string}`,
      amountIn: string,
      minAmountOut: string,
      nonce: bigint,
      decimalsIn: number = 18,
      decimalsOut: number = 18,
      deadlineMinutes: number = INTENT_DEADLINE_MINUTES
    ) => {
      if (!address) throw new Error("Wallet not connected")

      // Compute unix deadline (5m min, 24h max)
      const validatedDeadlineMinutes = Math.max(5, Math.min(1440, deadlineMinutes))
      const deadline = BigInt(Math.floor(Date.now() / 1000) + validatedDeadlineMinutes * 60)

      // Normalize inputs to BigInt
      const inputAmt = parseUnits(amountIn.replace(/,/g, ""), decimalsIn)
      const userAmtOut = parseUnits(minAmountOut.replace(/,/g, ""), decimalsOut)

      // Core Permit2 transfer data
      const permitData: PermitTransferFrom = {
        permitted: {
          token: tokenIn,
          amount: inputAmt,
        },
        spender: FAST_SETTLEMENT_ADDRESS,
        nonce,
        deadline,
      }

      // Witness data specifically for the Swap Intent logic
      const witness: SwapIntent = {
        user: address,
        inputToken: tokenIn,
        outputToken: tokenOut,
        inputAmt,
        userAmtOut,
        recipient: address,
        deadline,
        nonce,
      }

      // Construct EIP-712 payload
      const signature = await signTypedDataAsync({
        domain: {
          name: "Permit2",
          chainId,
          verifyingContract: PERMIT2_ADDRESS,
        },
        types: GET_SWAP_INTENT_TYPES(INTENT_WITNESS_TYPE_STRING),
        primaryType: "PermitWitnessTransferFrom",
        message: {
          ...permitData,
          witness,
        },
        account: address,
      })

      return {
        signature,
        intent: witness,
        permit: permitData,
      }
    },
    [address, chainId, signTypedDataAsync]
  )

  return { createIntentSignature }
}
