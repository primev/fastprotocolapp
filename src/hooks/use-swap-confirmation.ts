"use client"

import { useState, useCallback, useEffect } from "react"
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi"
import { parseUnits, type TransactionReceipt } from "viem"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { FASTSWAP_API_BASE } from "@/lib/network-config"
import type { Token } from "@/types/swap"
import { useBroadcastGasPrice } from "@/hooks/use-broadcast-gas-price"

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
  const { getFreshNonce, releaseNonce, syncFromChain } = usePermit2Nonce()
  const { sendTransactionAsync, data: sendTxHash } = useSendTransaction()
  const { gasFees, getFreshGasFees } = useBroadcastGasPrice()

  const [isSigning, setIsSigning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Get receipt data from wagmi (optional - used for fallback)
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: hash ? (hash as `0x${string}`) : undefined,
  })

  const onConfirmed = useCallback(() => {
    setIsSubmitting(false)
    setIsConfirming(false)
    setIsSuccess(true)
    syncFromChain()
    onSuccess?.()
  }, [onSuccess, syncFromChain])

  const onConfirmationError = useCallback((err: Error) => {
    console.error("[Swap confirmation] Tx confirmation error:", err)
    setIsSubmitting(false)
    setIsConfirming(false)
    setIsSuccess(false)
    setError(err instanceof Error ? err : new Error(String(err)))
  }, [])

  // Use custom hook that races DB polling vs wagmi receipt
  useWaitForTxConfirmation({
    hash: hash ?? undefined,
    receipt: (receipt as TransactionReceipt | undefined) ?? undefined,
    mode: "status",
    onConfirmed,
    onError: onConfirmationError,
  })

  useEffect(() => {
    // Only set confirming to true if we have a hash AND no error has occurred yet
    if (hash && !isSuccess && !error) {
      setIsConfirming(true)
    } else if (error) {
      // If an error arrives, we are no longer "confirming"
      setIsConfirming(false)
    }
  }, [hash, isSuccess, error])

  const reset = useCallback(() => {
    setIsSigning(false)
    setIsSubmitting(false)
    setIsConfirming(false)
    setIsSuccess(false)
    setHash(null)
    setError(null)
  }, [])

  const handleSwapError = useCallback((err: unknown) => {
    console.error("[Swap confirmation] Caught Error:", err)
    setIsSigning(false)
    setIsSubmitting(false)
    setIsConfirming(false)
    setError(err instanceof Error ? err : new Error(String(err)))
  }, [])

  const confirmSwap = useCallback(async () => {
    if (!isConnected || !address || !fromToken || !toToken || !amount) return
    reset()
    setIsSubmitting(true)

    // Always parse fresh values here
    const amountClean = amount.replace(/,/g, "")
    const minAmountOutClean = minAmountOut.replace(/,/g, "")

    const inputAmtWei = parseUnits(amountClean, fromToken.decimals).toString()
    const userAmtOutWei = parseUnits(minAmountOutClean, toToken.decimals).toString()

    try {
      if (fromToken.address === ZERO_ADDRESS && toToken.address !== WETH_ADDRESS) {
        await executeEthPath(inputAmtWei, userAmtOutWei)
      } else {
        await executePermitPath(inputAmtWei, userAmtOutWei)
      }
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
    handleSwapError,
    reset,
    getFreshGasFees,
    gasFees,
  ])

  async function executeEthPath(inputAmtWei: string, userAmtOutWei: string) {
    if (!address || !fromToken || !toToken) return

    const deadlineUnix = Math.floor(Date.now() / 1000) + Math.max(5, Math.min(1440, deadline)) * 60

    const body = {
      outputToken: toToken.address,
      inputAmt: inputAmtWei,
      userAmtOut: userAmtOutWei,
      sender: address,
      deadline: String(deadlineUnix),
    }

    const ethResp = await fetch(`${FASTSWAP_API_BASE}/fastswap/eth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const ethData = await ethResp.json()

    if (!ethResp.ok || !ethData?.to || !ethData?.data) {
      throw new Error(ethData?.error || "FastSwap API error")
    }

    const freshGasFees = await getFreshGasFees()
    const txHash = await sendTransactionAsync({
      to: ethData.to as `0x${string}`,
      data: ethData.data,
      value: BigInt(ethData.value),
      ...(freshGasFees ?? gasFees),
    })

    if (txHash) {
      setHash(txHash)
      setIsSubmitting(false) // Transaction submitted, now waiting for confirmation
    }
  }

  async function executePermitPath(inputAmtWei: string, userAmtOutWei: string) {
    if (!fromToken || !toToken) return
    setIsSubmitting(false)
    setIsSigning(true)

    const nonce = getFreshNonce()
    const tokenInAddress = fromToken.address === ZERO_ADDRESS ? WETH_ADDRESS : fromToken.address
    const tokenOutAddress = toToken.address === ZERO_ADDRESS ? WETH_ADDRESS : toToken.address

    const intentData = await createIntentSignature(
      tokenInAddress as `0x${string}`,
      tokenOutAddress as `0x${string}`,
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
      ...intentData.intent,
      inputAmt: inputAmtWei,
      userAmtOut: userAmtOutWei,
      deadline: intentData.intent.deadline.toString(),
      nonce: intentData.intent.nonce.toString(),
      signature: intentData.signature,
    }

    const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const result = await resp.json()

    if (!resp.ok || !result?.txHash) {
      releaseNonce(nonce)
      throw new Error(result?.error || "FastSwap API error")
    }

    if (result.txHash) {
      setHash(result.txHash)
      setIsSubmitting(false) // Transaction submitted, now waiting for confirmation
    }
  }

  return {
    confirmSwap,
    isSigning,
    isSubmitting,
    isConfirming,
    isSuccess,
    hash,
    error,
    reset,
  }
}
