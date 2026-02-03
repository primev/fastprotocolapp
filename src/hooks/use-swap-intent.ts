"use client"

import { useCallback, useState } from "react"
import { useSignTypedData, useAccount, useChainId } from "wagmi"
import { parseUnits } from "viem"
import {
  PERMIT2_ADDRESS,
  FAST_SETTLEMENT_ADDRESS,
  INTENT_DEADLINE_MINUTES,
} from "@/lib/swap-constants"
import { INTENT_WITNESS_TYPE_STRING, GET_SWAP_INTENT_TYPES } from "@/lib/permit2-utils"
import type { SwapIntent, PermitTransferFrom } from "@/types/swap"

export function useSwapIntent() {
  const { signTypedDataAsync } = useSignTypedData()
  const { address } = useAccount()
  const chainId = useChainId()

  /**
   * Creates a signed intent for a swap
   */
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

      // --- 1. Compute fresh deadline ---
      const validatedDeadlineMinutes = Math.max(5, Math.min(1440, deadlineMinutes))
      const deadline = BigInt(Math.floor(Date.now() / 1000) + validatedDeadlineMinutes * 60)

      // --- 2. Clean amounts and convert to wei ---
      const amountInClean = amountIn.replace(/,/g, "")
      const minAmountOutClean = minAmountOut.replace(/,/g, "")
      const inputAmt = parseUnits(amountInClean, decimalsIn)
      const userAmtOut = parseUnits(minAmountOutClean, decimalsOut)

      // --- 3. Prepare Permit2 basic data ---
      const permitData: PermitTransferFrom = {
        permitted: {
          token: tokenIn,
          amount: inputAmt,
        },
        spender: FAST_SETTLEMENT_ADDRESS,
        nonce,
        deadline,
      }

      // --- 4. Prepare witness data (matches Solidity order exactly) ---
      const witness: SwapIntent = {
        user: address,
        inputToken: tokenIn,
        outputToken: tokenOut,
        inputAmt: inputAmt,
        userAmtOut: userAmtOut,
        recipient: address,
        deadline: deadline,
        nonce: nonce,
      }

      // --- 5. Build EIP-712 message ---
      const eip712Message = {
        domain: {
          name: "Permit2",
          chainId,
          verifyingContract: PERMIT2_ADDRESS,
        },
        types: GET_SWAP_INTENT_TYPES(INTENT_WITNESS_TYPE_STRING),
        primaryType: "PermitWitnessTransferFrom" as const,
        message: {
          ...permitData,
          witness,
        },
      }

      // --- 6. Sign ---
      const signature = await signTypedDataAsync({
        ...eip712Message,
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
