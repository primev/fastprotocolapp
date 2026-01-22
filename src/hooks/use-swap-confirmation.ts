"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { useToast } from "@/hooks/use-toast"
import {
  isTransactionRejection,
  getTransactionErrorMessage,
  getTransactionErrorTitle,
} from "@/lib/transaction-errors"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"

interface UseSwapConfirmationParams {
  fromToken: Token | undefined
  toToken: Token | undefined
  amount: string
  minAmountOut: string
  deadline: number
  onSuccess?: () => void
}

export function useSwapConfirmation({
  fromToken,
  toToken,
  amount,
  minAmountOut,
  deadline,
  onSuccess,
}: UseSwapConfirmationParams) {
  const { isConnected, address } = useAccount()
  const { createIntentSignature } = useSwapIntent()
  const { nonce } = usePermit2Nonce()
  const { toast } = useToast()

  const [isSigning, setIsSigning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const confirmSwap = async () => {
    if (!isConnected || !address || !fromToken || !toToken || !amount) {
      return
    }

    setIsSigning(true)

    try {
      const tokenInAddress =
        fromToken.address === ZERO_ADDRESS ? WETH_ADDRESS : (fromToken.address as `0x${string}`)
      const tokenOutAddress =
        toToken.address === ZERO_ADDRESS ? WETH_ADDRESS : (toToken.address as `0x${string}`)

      const intentData = await createIntentSignature(
        tokenInAddress,
        tokenOutAddress,
        amount,
        minAmountOut,
        nonce,
        fromToken.decimals,
        toToken.decimals,
        deadline
      )

      setIsSigning(false)
      setIsSubmitting(true)

      const response = await fetch("/api/relay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature: intentData.signature,
          intent: {
            ...intentData.intent,
            inputAmt: intentData.intent.inputAmt.toString(),
            userAmtOut: intentData.intent.userAmtOut.toString(),
            deadline: intentData.intent.deadline.toString(),
            nonce: intentData.intent.nonce.toString(),
          },
          permit: {
            ...intentData.permit,
            permitted: {
              ...intentData.permit.permitted,
              amount: intentData.permit.permitted.amount.toString(),
            },
            deadline: intentData.permit.deadline.toString(),
            nonce: intentData.permit.nonce.toString(),
          },
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || "Transaction failed")
      }

      setIsSubmitting(false)
      toast({
        title: "Swap Submitted",
        description:
          "Your swap intent has been submitted successfully. The relayer will execute it shortly.",
      })

      onSuccess?.()
    } catch (error) {
      console.error("Swap error:", error)
      setIsSigning(false)
      setIsSubmitting(false)

      toast({
        title: getTransactionErrorTitle(error, "swap"),
        description: getTransactionErrorMessage(error, "swap"),
        variant: "destructive",
      })
    }
  }

  return {
    confirmSwap,
    isSigning,
    isSubmitting,
  }
}
