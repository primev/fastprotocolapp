"use client"

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
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { FASTSWAP_API_BASE } from "@/lib/network-config"
import { getTransactionErrorMessage } from "@/lib/transaction-errors"
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
  const { getFreshNonce, releaseNonce, syncFromChain } = usePermit2Nonce()
  const { sendTransactionAsync, data: sendTxHash } = useSendTransaction()
  const { data: feeData } = useEstimateFeesPerGas()
  const { data: legacyGasPrice } = useGasPrice()

  const [isSigning, setIsSigning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (sendTxHash) setHash(sendTxHash)
  }, [sendTxHash])

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({
    hash: hash ? (hash as `0x${string}`) : undefined,
  })

  const onConfirmed = useCallback(() => {
    console.log("[Swap confirmation] Transaction Confirmed on-chain")
    setIsSubmitting(false)
    syncFromChain()
    onSuccess?.()
  }, [onSuccess, syncFromChain])

  const onConfirmationError = useCallback((err: Error) => {
    console.error("[Swap confirmation] Tx confirmation error:", err)
    setIsSubmitting(false)
    const cleanMessage = getTransactionErrorMessage(err, "swap")
    setError(new Error(cleanMessage))
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

  const handleSwapError = useCallback((err: unknown) => {
    console.error("[Swap confirmation] Caught Error:", err)
    setIsSigning(false)
    setIsSubmitting(false)
    const message = getTransactionErrorMessage(err, "swap")
    setError(new Error(message))
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

    console.log("inputAmtWei", inputAmtWei)
    console.log("userAmtOutWei", userAmtOutWei)

    try {
      if (fromToken.address === ZERO_ADDRESS && toToken.address !== WETH_ADDRESS) {
        await executeEthPath(inputAmtWei, userAmtOutWei)
      } else {
        await executePermitPath(inputAmtWei, userAmtOutWei)
      }
    } catch (err) {
      handleSwapError(err)
    }
  }, [isConnected, address, fromToken, toToken, amount, minAmountOut, handleSwapError, reset])

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

    console.log("[ETH Path] Requesting Unsigned TX:", body)

    const ethResp = await fetch(`${FASTSWAP_API_BASE}/fastswap/eth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const ethData = await ethResp.json()
    console.log("[ETH Path] API Response:", ethData)

    if (!ethResp.ok || !ethData?.to || !ethData?.data) {
      throw new Error(ethData?.error || "FastSwap API error")
    }

    const gasLimit = ethData.gasLimit ? BigInt(Math.ceil(ethData.gasLimit * 1.2)) : undefined
    const gasFees =
      feeData?.maxFeePerGas != null
        ? { maxFeePerGas: (feeData.maxFeePerGas * 120n) / 100n, maxPriorityFeePerGas: 0n }
        : legacyGasPrice
          ? { gasPrice: legacyGasPrice }
          : undefined

    console.log("[ETH Path] Sending Transaction via Wallet...")
    const txHash = await sendTransactionAsync({
      to: ethData.to as `0x${string}`,
      data: ethData.data,
      value: BigInt(ethData.value),
      gas: gasLimit,
      ...gasFees,
    })

    if (txHash) {
      console.log("[ETH Path] Transaction Sent! Hash:", txHash)
      setHash(txHash)
    }
  }

  async function executePermitPath(inputAmtWei: string, userAmtOutWei: string) {
    if (!fromToken || !toToken) return
    setIsSubmitting(false)
    setIsSigning(true)

    const nonce = getFreshNonce()
    const tokenInAddress = fromToken.address === ZERO_ADDRESS ? WETH_ADDRESS : fromToken.address
    const tokenOutAddress = toToken.address === ZERO_ADDRESS ? WETH_ADDRESS : toToken.address

    console.log("[Permit Path] Creating Intent Signature. Nonce:", nonce.toString())

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

    console.log("[Permit Path] Signature Created:", intentData.signature)

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

    console.log("[Permit Path] Submitting to Executor:", body)

    const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const result = await resp.json()
    console.log("[Permit Path] API Response:", result)

    if (!resp.ok || !result?.txHash) {
      console.warn("[Permit Path] API Error - Releasing Nonce")
      releaseNonce(nonce)
      throw new Error(result?.error || "FastSwap API error")
    }

    if (result.txHash) {
      console.log("[Permit Path] Executor Success! Hash:", result.txHash)
      setHash(result.txHash)
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
