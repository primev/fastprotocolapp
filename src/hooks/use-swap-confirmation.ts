"use client"

/**
 * useSwapConfirmation
 *
 * Handles the full swap confirmation flow for FastSwap:
 * - ETH path: user pays with native ETH → API returns unsigned tx → user signs & sends.
 * - Permit path: user signs intent (Permit2) → API submits via executor → returns tx hash.
 *
 * Manages signing/submitting state, tx hash, receipt waiting, and success/error toasts.
 */

import { useState, useCallback, useEffect } from "react"
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useEstimateFeesPerGas,
  useGasPrice,
} from "wagmi"
import { parseUnits, type TransactionReceipt } from "viem"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { useToast } from "@/hooks/use-toast"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { FASTSWAP_API_BASE } from "@/lib/network-config"
import type { Token } from "@/types/swap"

// --- Params & API types ------------------------------------------------------

/** Inputs for the swap confirmation flow (tokens, amount, deadline, success callback). */
interface UseSwapConfirmationParams {
  fromToken: Token | undefined
  toToken: Token | undefined
  amount: string
  minAmountOut: string
  deadline: number
  onSuccess?: () => void
}

/** FastSwap POST /fastswap/eth response: unsigned tx for the user to sign and submit. */
interface FastSwapEthResponse {
  to: string
  data: `0x${string}`
  value: string
  chainId: number
  gasLimit?: number
  status: "success" | "error"
  error?: string
}

/** FastSwap POST /fastswap response: executor-submitted swap (txHash returned). */
interface FastSwapResponse {
  txHash?: string
  outputAmount?: string
  gasLimit?: number
  status: "success" | "error"
  error?: string
}

// Deadline bounds (minutes): clamp user-facing deadline to a safe range.
const DEADLINE_MIN_MINUTES = 5
const DEADLINE_MAX_MINUTES = 1440

// --- Hook --------------------------------------------------------------------

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
  const { getFreshNonce, releaseNonce, syncFromChain } = usePermit2Nonce()
  const { toast } = useToast()
  const { sendTransactionAsync, data: sendTxHash } = useSendTransaction()
  const { data: feeData } = useEstimateFeesPerGas()
  const { data: legacyGasPrice } = useGasPrice()

  const [isSigning, setIsSigning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Sync hash from wallet when user completes sendTransaction (ETH path).
  useEffect(() => {
    if (sendTxHash) setHash(sendTxHash)
  }, [sendTxHash])

  const { data: receipt } = useWaitForTransactionReceipt({
    hash: hash ? (hash as `0x${string}`) : undefined,
  })

  const onConfirmed = useCallback(() => {
    setIsSubmitting(false)
    syncFromChain()
    toast({
      title: "Swap Confirmed",
      description: "Your transaction has been mined and confirmed.",
    })
    onSuccess?.()
  }, [toast, onSuccess, syncFromChain])

  const onConfirmationError = useCallback((err: Error) => {
    setIsSubmitting(false)
    setError(err)
  }, [])

  useWaitForTxConfirmation({
    hash: hash ?? undefined,
    receipt: (receipt as TransactionReceipt | undefined) ?? undefined,
    mode: "status",
    onConfirmed,
    onError: onConfirmationError,
  })

  const reset = useCallback(() => {
    setIsSigning(false)
    setIsSubmitting(false)
    setHash(null)
    setError(null)
  }, [])

  /**
   * Runs the swap confirmation flow. Chooses ETH path (user signs tx) or Permit path
   * (user signs intent, executor submits) based on fromToken. Call from confirm button.
   */
  const confirmSwap = useCallback(async () => {
    if (!isConnected || !address || !fromToken || !toToken || !amount) return

    reset()
    setIsSubmitting(true)

    const isEthPath = fromToken.address === ZERO_ADDRESS && toToken.address !== WETH_ADDRESS

    try {
      if (isEthPath) {
        await executeEthPath()
        return
      }
      await executePermitPath()
    } catch (err) {
      handleSwapError(err)
    }
  }, [
    isConnected,
    address,
    fromToken,
    toToken,
    amount,
    minAmountOut,
    deadline,
    getFreshNonce,
    releaseNonce,
    reset,
    createIntentSignature,
    sendTransactionAsync,
    toast,
  ])

  async function executeEthPath() {
    if (!address || !fromToken || !toToken) return

    const deadlineUnix =
      Math.floor(Date.now() / 1000) +
      Math.max(DEADLINE_MIN_MINUTES, Math.min(DEADLINE_MAX_MINUTES, deadline)) * 60
    const amountClean = amount.replace(/,/g, "")
    const minAmountOutClean = minAmountOut.replace(/,/g, "")
    const inputAmtWei = parseUnits(amountClean, fromToken.decimals).toString()
    const userAmtOutWei = parseUnits(minAmountOutClean, toToken.decimals).toString()

    console.log("Execute Eth Path")
    console.log(
      "Swap Path Body",
      JSON.stringify({
        outputToken: toToken.address,
        inputAmt: inputAmtWei,
        userAmtOut: userAmtOutWei,
        sender: address,
        deadline: String(deadlineUnix),
      })
    )

    const ethResp = await fetch(`${FASTSWAP_API_BASE}/fastswap/eth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outputToken: toToken.address,
        inputAmt: inputAmtWei,
        userAmtOut: userAmtOutWei,
        sender: address,
        deadline: String(deadlineUnix),
      }),
    })

    const text = await ethResp.text()

    console.log("Execute Eth Path")
    console.log("Swap Path Response", text)

    let ethData: FastSwapEthResponse | null = null
    try {
      ethData = text ? (JSON.parse(text) as FastSwapEthResponse) : null
    } catch {
      ethData = null
    }

    if (!ethResp.ok || !ethData || ethData.status === "error") {
      const apiError = ethData?.error ?? text ?? "FastSwap API error"
      setIsSubmitting(false)
      setError(new Error(apiError))
      toast({
        title: "Swap failed",
        description: "The swap service is temporarily unavailable. Please try again.",
        variant: "destructive",
      })
      return
    }

    const gasLimit =
      ethData.gasLimit != null ? BigInt(Math.ceil(ethData.gasLimit * 1.2)) : undefined

    const gasFees =
      feeData?.maxFeePerGas != null && feeData?.maxPriorityFeePerGas != null
        ? {
            maxFeePerGas: (feeData.maxFeePerGas * 120n) / 100n,
            maxPriorityFeePerGas: 0n,
          }
        : legacyGasPrice != null
          ? { gasPrice: legacyGasPrice }
          : undefined

    const txHash = await sendTransactionAsync({
      to: ethData.to as `0x${string}`,
      data: ethData.data,
      value: BigInt(ethData.value),
      gas: gasLimit,
      ...gasFees,
    })

    if (txHash) setHash(txHash)
  }

  async function executePermitPath() {
    if (!fromToken || !toToken) return

    setIsSubmitting(false)
    setIsSigning(true)

    const nonce = getFreshNonce()
    console.log("[Permit path] nonce for this attempt:", nonce.toString(), "(bigint)", nonce)

    const tokenInAddress =
      fromToken.address === ZERO_ADDRESS ? WETH_ADDRESS : (fromToken.address as `0x${string}`)
    const tokenOutAddress =
      toToken.address === ZERO_ADDRESS ? WETH_ADDRESS : (toToken.address as `0x${string}`)

    console.log("Execute Permit Path")
    console.log(
      "Swap Signature Creation Body",
      JSON.stringify({
        tokenInAddress: tokenInAddress,
        tokenOutAddress: tokenOutAddress,
        amount: amount,
        minAmountOut: minAmountOut,
        nonce: nonce.toString(),
        decimalsIn: fromToken.decimals,
        decimalsOut: toToken.decimals,
        deadline: deadline,
      })
    )

    let intentData
    try {
      intentData = await createIntentSignature(
        tokenInAddress,
        tokenOutAddress,
        amount,
        minAmountOut,
        nonce,
        fromToken.decimals,
        toToken.decimals,
        deadline
      )
    } catch (err) {
      releaseNonce(nonce)
      throw err
    }

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

    console.log("Execute Permit Path")
    console.log("Swap Path Body", JSON.stringify(body))
    console.log("[Permit path] POST", `${FASTSWAP_API_BASE}/fastswap`, "nonce in body:", body.nonce)

    const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const permitText = await resp.text()

    console.log("Execute Permit Path")
    console.log("[Permit path] Response status:", resp.status, resp.statusText)
    console.log("[Permit path] Swap Path Response (raw):", permitText)
    let result: FastSwapResponse | null = null
    try {
      result = permitText ? (JSON.parse(permitText) as FastSwapResponse) : null
    } catch {
      result = null
    }

    if (!resp.ok || !result || result.status === "error") {
      console.log("[Permit path] API error – releasing nonce", nonce.toString(), "result:", result)
      releaseNonce(nonce)
      const apiError = result?.error ?? permitText ?? "FastSwap API error"
      const isNonceTooLow = String(apiError).toLowerCase().includes("nonce too low")
      setIsSubmitting(false)
      setError(new Error(apiError))
      toast({
        title: "Swap failed",
        description: isNonceTooLow
          ? "Transaction nonce conflict. Please try again in a moment."
          : "The swap service is temporarily unavailable. Please try again.",
        variant: "destructive",
      })
      return
    }

    if (result.txHash) {
      console.log("[Permit path] Success, txHash:", result.txHash)
      setHash(result.txHash)
    } else {
      console.log("[Permit path] No txHash in result:", result)
    }
  }

  function handleSwapError(err: unknown) {
    setIsSigning(false)
    setIsSubmitting(false)

    const message = err instanceof Error ? err.message : String(err)
    if (message.toLowerCase().includes("user rejected")) {
      setError(new Error("Transaction rejected in wallet."))
      return
    }

    const error = err instanceof Error ? err : new Error(message)
    setError(error)
    toast({
      title: "Swap failed",
      description: message,
      variant: "destructive",
    })
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
