"use client"

import { useSignTypedData, useAccount, useChainId } from "wagmi"
import { parseUnits } from "viem"
import { PERMIT2_ADDRESS, FAST_SETTLEMENT_ADDRESS } from "@/lib/swap-constants"
import { INTENT_WITNESS_TYPE_STRING, GET_SWAP_INTENT_TYPES } from "@/lib/permit2-utils"
import type { SwapIntent, PermitTransferFrom } from "@/types/swap"

export function useSwapIntent() {
  const { signTypedDataAsync } = useSignTypedData()
  const { address } = useAccount()
  const chainId = useChainId()

  /**
   * Creates a signed intent for a swap
   * @param tokenIn The address of the token being sold
   * @param tokenOut The address of the token being bought
   * @param amountIn Raw amount of input token (as string)
   * @param minAmountOut Minimum output expected (slippage applied, as string)
   * @param nonce Nonce fetched from usePermit2Nonce()
   * @param decimalsIn Decimals for input token
   * @param decimalsOut Decimals for output token
   */
  const createIntentSignature = async (
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: string,
    minAmountOut: string,
    nonce: bigint,
    decimalsIn: number = 18,
    decimalsOut: number = 18
  ) => {
    if (!address) throw new Error("Wallet not connected")

    // 1. Prepare Permit2 Basic Data
    const permitData: PermitTransferFrom = {
      permitted: {
        token: tokenIn,
        amount: parseUnits(amountIn, decimalsIn),
      },
      spender: FAST_SETTLEMENT_ADDRESS,
      nonce: nonce,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 1800), // 30 min deadline
    }

    // 2. Prepare Custom Witness Data (The Intent)
    // MUST match the order in your Solidity Intent struct
    const witness: SwapIntent = {
      user: address,
      inputToken: tokenIn,
      outputToken: tokenOut,
      inputAmt: permitData.permitted.amount,
      userAmtOut: parseUnits(minAmountOut, decimalsOut),
      recipient: address,
      deadline: permitData.deadline,
      nonce: permitData.nonce,
    }

    try {
      const signature = await signTypedDataAsync({
        domain: {
          name: "Permit2",
          chainId,
          verifyingContract: PERMIT2_ADDRESS,
        },
        // Using the helper to get the alphabetical type definitions
        types: GET_SWAP_INTENT_TYPES(INTENT_WITNESS_TYPE_STRING),
        primaryType: "PermitWitnessTransferFrom",
        message: {
          ...permitData,
          witness,
        },
      })

      return {
        signature,
        intent: witness,
        permit: permitData,
      }
    } catch (error) {
      console.error("Intent Signing Failed:", error)
      throw error
    }
  }

  return { createIntentSignature }
}
