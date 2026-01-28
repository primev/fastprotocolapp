"use client"

import { useState, useCallback, useEffect } from "react"
import { useAccount, useSendTransaction } from "wagmi"
import { parseUnits } from "viem"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { useToast } from "@/hooks/use-toast"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { FASTSWAP_API_BASE } from "@/lib/network-config"
import type { Token } from "@/types/swap"

interface UseSwapConfirmationParams {
  fromToken: Token | undefined
  toToken: Token | undefined
  amount: string
  minAmountOut: string
  deadline: number
  onSuccess?: () => void
}

/** FastSwap /fastswap/eth response — unsigned tx for user to sign and submit */
interface FastSwapEthResponse {
  to: string
  data: `0x${string}`
  value: string
  chainId: number
  gasLimit?: number
  status: "success" | "error"
  error?: string
}

/** FastSwap /fastswap response — executor-submitted swap */
interface FastSwapResponse {
  txHash?: string
  outputAmount?: string
  gasLimit?: number
  status: "success" | "error"
  error?: string
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

  const { sendTransactionAsync, data: sendTxHash } = useSendTransaction()

  const [isSigning, setIsSigning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (sendTxHash) setHash(sendTxHash)
  }, [sendTxHash])

  const reset = useCallback(() => {
    setIsSigning(false)
    setIsSubmitting(false)
    setHash(null)
    setError(null)
  }, [])

  const confirmSwap = async () => {
    if (!isConnected || !address || !fromToken || !toToken || !amount) return

    reset()
    setIsSubmitting(true)

    try {
      const isExecuteWithETH =
        fromToken.address === ZERO_ADDRESS && toToken.address !== WETH_ADDRESS

      if (isExecuteWithETH) {
        // ETH path: POST /fastswap/eth → returns unsigned tx → user signs and sends
        const deadlineUnix =
          Math.floor(Date.now() / 1000) + Math.max(5, Math.min(1440, deadline)) * 60
        const inputAmtWei = parseUnits(amount, fromToken.decimals).toString()
        const userAmtOutWei = parseUnits(minAmountOut, toToken.decimals).toString()

        const ethResp = await fetch(`${FASTSWAP_API_BASE}/fastswap/eth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outputToken: toToken.address,
            inputAmt: inputAmtWei,
            userAmtOut: userAmtOutWei,
            sender: address,
            deadline: deadlineUnix,
          }),
        })

        const ethData = (await ethResp.json()) as FastSwapEthResponse

        if (ethData.status === "error" || !ethResp.ok) {
          throw new Error(ethData.error ?? "FastSwap ETH request failed")
        }

        const txHash = await sendTransactionAsync({
          to: ethData.to as `0x${string}`,
          data: ethData.data,
          value: BigInt(ethData.value),
          gas: ethData.gasLimit != null ? BigInt(ethData.gasLimit) : undefined,
        })

        if (txHash) setHash(txHash)
        setIsSubmitting(false)
        toast({
          title: "Swap Confirmed",
          description: "Your transaction has been submitted.",
        })
        onSuccess?.()
        return
      }

      // Permit path: sign intent, then POST /fastswap (executor submits)
      setIsSubmitting(false)
      setIsSigning(true)

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

      const body = {
        user: intentData.intent.user,
        inputToken: intentData.intent.inputToken,
        outputToken: intentData.intent.outputToken,
        inputAmt: intentData.intent.inputAmt.toString(),
        userAmtOut: intentData.intent.userAmtOut.toString(),
        recipient: intentData.intent.recipient,
        deadline: intentData.intent.deadline.toString(),
        nonce: intentData.intent.nonce.toString(),
        signature: intentData.signature,
      }

      const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = (await resp.json()) as FastSwapResponse

      if (result.status === "error" || !resp.ok) {
        throw new Error(result.error ?? "FastSwap request failed")
      }

      if (result.txHash) setHash(result.txHash)

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
