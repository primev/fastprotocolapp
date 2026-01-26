"use client"

import { useState, useCallback } from "react"
import { useAccount } from "wagmi"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { useToast } from "@/hooks/use-toast"
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
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const reset = useCallback(() => {
    setIsSigning(false)
    setIsSubmitting(false)
    setHash(null)
    setError(null)
  }, [])

  const confirmSwap = async () => {
    if (!isConnected || !address || !fromToken || !toToken || !amount) return

    reset()
    setIsSigning(true)

    try {
      // 1. Normalize Addresses
      const tokenInAddress =
        fromToken.address === ZERO_ADDRESS ? WETH_ADDRESS : (fromToken.address as `0x${string}`)
      const tokenOutAddress =
        toToken.address === ZERO_ADDRESS ? WETH_ADDRESS : (toToken.address as `0x${string}`)

      // 2. Phase: SIGNING (Wallet Interaction)
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
      setIsSubmitting(true) // 3. Phase: SUBMITTING (Relay & Mining)

      // 4. Relay to API
      const response = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        throw new Error(result.message || "Relay execution failed")
      }

      // 5. Success: Capture Hash for the UI
      if (result.txHash || result.hash) {
        setHash(result.txHash || result.hash)
      }

      setIsSubmitting(false)
      toast({
        title: "Swap Confirmed",
        description: "Your transaction has been mined and confirmed.",
      })

      onSuccess?.()
    } catch (err) {
      console.error("Swap error:", err)
      setIsSigning(false)
      setIsSubmitting(false)

      // Handle user rejection vs technical error
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.toLowerCase().includes("user rejected")) {
        setError(new Error("Transaction rejected in wallet."))
      } else {
        setError(err instanceof Error ? err : new Error(errorMessage))
      }
    }
  }

  return {
    confirmSwap,
    isSigning,
    isSubmitting,
    hash,
    error,
    reset,
  }
}
