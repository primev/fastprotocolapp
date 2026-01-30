"use client"

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
   * @param tokenIn The address of the token being sold
   * @param tokenOut The address of the token being bought
   * @param amountIn Raw amount of input token (as string)
   * @param minAmountOut Minimum output expected (slippage applied, as string)
   * @param nonce Nonce fetched from usePermit2Nonce()
   * @param decimalsIn Decimals for input token
   * @param decimalsOut Decimals for output token
   * @param deadlineMinutes Custom deadline in minutes (defaults to INTENT_DEADLINE_MINUTES)
   */
  const createIntentSignature = async (
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

    // Validate deadline range (5 minutes to 24 hours)
    const validatedDeadlineMinutes = Math.max(5, Math.min(1440, deadlineMinutes))
    const deadline = BigInt(Math.floor(Date.now() / 1000) + validatedDeadlineMinutes * 60)

    // Strip locale formatting (e.g. commas) so parseUnits receives a valid decimal string
    const amountInClean = amountIn.replace(/,/g, "")
    const minAmountOutClean = minAmountOut.replace(/,/g, "")

    // 1. Prepare Permit2 Basic Data
    const permitData: PermitTransferFrom = {
      permitted: {
        token: tokenIn,
        amount: parseUnits(amountInClean, decimalsIn),
      },
      spender: FAST_SETTLEMENT_ADDRESS,
      nonce: nonce,
      deadline: deadline,
    }

    // 2. Prepare Custom Witness Data (The Intent)
    // MUST match the order in Solidity Intent struct
    const witness: SwapIntent = {
      user: address,
      inputToken: tokenIn,
      outputToken: tokenOut,
      inputAmt: permitData.permitted.amount,
      userAmtOut: parseUnits(minAmountOutClean, decimalsOut),
      recipient: address,
      deadline: permitData.deadline,
      nonce: permitData.nonce,
    }

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

    const signature = await signTypedDataAsync({
      ...eip712Message,
      account: address!,
    })

    return {
      signature,
      intent: witness,
      permit: permitData,
    }
  }

  return { createIntentSignature }
}
