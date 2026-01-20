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

    /**
     * DEADLINE SECURITY CONSTRAINT (2026 Standards)
     *
     * In 2026, the deadline (or expiration timestamp) is a hard security constraint within the smart contract.
     * If a relayer attempts to execute your intent even one second after this timestamp, the Permit2 or Settler
     * contract will automatically revert the transaction.
     *
     * Standards & Specifications:
     *
     * 1. Uniswap v4 & Permit2 Technical Standards
     *    - According to Uniswap v4 Developer Documentation, every swap executed through the Universal Router
     *      requires a deadline parameter.
     *    - Standard Buffer: Uniswap recommends a 20-minute to 30-minute window.
     *    - Security Rule: Official guides strictly state: "Never use block.timestamp or type(uint256).max as
     *      the deadline parameter" in production.
     *      - Using block.timestamp on the frontend is meaningless because it evaluates at the moment of signing,
     *        not execution.
     *      - Using max leaves your signature valid forever, creating a permanent security vulnerability.
     *    - Source: Uniswap Docs: v4 Swap Quickstart
     *
     * 2. ERC-7683: The Intent Standard
     *    - Your "Intent" model follows the ERC-7683 standard (co-authored by Uniswap and Across).
     *    - This standard formally separates the deadline into two phases for cross-chain or complex intents:
     *      - openDeadline: The time by which the order must be "opened" (locked) on the source chain.
     *      - fillDeadline: The time by which the solver must deliver the funds to you on the destination chain.
     *    - Source: ERC-7683 Specification and Nethermind: Open Intent Framework
     *
     * 3. Permit2 SignatureTransfer Struct
     *    - Your use-swap-intent hook uses the PermitTransferFrom struct.
     *    - The deadline field here is natively enforced by the Permit2 contract.
     *    - Field: deadline (uint256) - The timestamp after which the signature is no longer valid for the spender.
     *    - Source: Uniswap Docs: Permit2 SignatureTransfer Reference
     *
     * 4. Implementation Logic
     *    - Following these docs, the deadline is calculated as a relative offset from the user's current local time.
     *    - Standard 2026 Intent Deadline Logic: DEADLINE_MINUTES * 60 seconds from now.
     *
     * 5. Why Solvers Need This Time
     *    - In an intent-based system, the Relayer (Solver) might wait for a few blocks to:
     *      - Batch your trade with others to save on gas (Coincidence of Wants).
     *      - Wait for a price improvement on a different L2 to offer you a better rate than the current quote.
     *      - Ensure finality on the chain before they risk their own capital to fill your order.
     *
     * Note: Users can adjust the deadline via the settings modal. The deadlineMinutes parameter
     * allows customization while maintaining security constraints (minimum 5 minutes, maximum 24 hours).
     */
    // Validate deadline range (5 minutes to 24 hours)
    const validatedDeadlineMinutes = Math.max(5, Math.min(1440, deadlineMinutes))
    const deadline = BigInt(Math.floor(Date.now() / 1000) + validatedDeadlineMinutes * 60)

    // 1. Prepare Permit2 Basic Data
    const permitData: PermitTransferFrom = {
      permitted: {
        token: tokenIn,
        amount: parseUnits(amountIn, decimalsIn),
      },
      spender: FAST_SETTLEMENT_ADDRESS,
      nonce: nonce,
      deadline: deadline,
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

    // Prepare the EIP-712 message structure
    const eip712Message = {
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
    }

    // Log the data that will be signed
    console.log("=== EIP-712 Data to be Signed ===")
    console.log("Domain:", {
      name: eip712Message.domain.name,
      chainId: eip712Message.domain.chainId,
      verifyingContract: eip712Message.domain.verifyingContract,
    })
    console.log("Primary Type:", eip712Message.primaryType)
    console.log("Message (Permit + Witness):", {
      permitted: {
        token: permitData.permitted.token,
        amount: permitData.permitted.amount.toString(),
      },
      spender: permitData.spender,
      nonce: permitData.nonce.toString(),
      deadline: permitData.deadline.toString(),
      witness: {
        user: witness.user,
        inputToken: witness.inputToken,
        outputToken: witness.outputToken,
        inputAmt: witness.inputAmt.toString(),
        userAmtOut: witness.userAmtOut.toString(),
        recipient: witness.recipient,
        deadline: witness.deadline.toString(),
        nonce: witness.nonce.toString(),
      },
    })
    console.log("Types:", eip712Message.types)
    console.log("=================================")

    try {
      const signature = await signTypedDataAsync(eip712Message)

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
