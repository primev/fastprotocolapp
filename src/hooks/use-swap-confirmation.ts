"use client"

import { useState, useCallback, useEffect } from "react"
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi"
import {
  useBroadcastGasPrice,
  ETH_PATH_GAS_LIMIT_MULTIPLIER,
} from "@/hooks/use-broadcast-gas-price"
import { mainnet } from "wagmi/chains"
import { parseUnits, type TransactionReceipt } from "viem"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
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

/**
 * Orchestrates the swap execution process.
 * Handles two paths:
 * 1. ETH Path (Direct transaction via API data)
 * 2. Permit Path (EIP-712 signature submission to a relayer)
 */
export function useSwapConfirmation({
  fromToken,
  toToken,
  amount,
  minAmountOut,
  deadline,
  onSuccess,
}: UseSwapConfirmationParams) {
  const { isConnected, address } = useAccount()
  const { getFreshGasFees } = useBroadcastGasPrice()
  const publicClient = usePublicClient({ chainId: mainnet.id })

  const { createIntentSignature } = useSwapIntent()
  const { getFreshNonce, releaseNonce, syncFromChain } = usePermit2Nonce()
  const { sendTransactionAsync } = useSendTransaction()

  // --- Transaction State ---
  const [isSigning, setIsSigning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Wagmi receipt hook used as a data source for the race-condition confirmation hook
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: hash ? (hash as `0x${string}`) : undefined,
  })

  const onConfirmed = useCallback(() => {
    setIsSubmitting(false)
    setIsConfirming(false)
    setIsSuccess(true)
    syncFromChain() // Refresh nonce state
    onSuccess?.()
  }, [onSuccess, syncFromChain])

  const onConfirmationError = useCallback((err: Error) => {
    setIsSubmitting(false)
    setIsConfirming(false)
    setError(err instanceof Error ? err : new Error(String(err)))
  }, [])

  // Races DB polling against on-chain receipt
  useWaitForTxConfirmation({
    hash: hash ?? undefined,
    receipt: (receipt as TransactionReceipt | undefined) ?? undefined,
    mode: "status",
    onConfirmed,
    onError: onConfirmationError,
  })

  // Sync confirmation status based on hash availability
  useEffect(() => {
    if (hash && !isSuccess && !error) {
      setIsConfirming(true)
    } else if (error) {
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
    setIsSigning(false)
    setIsSubmitting(false)
    setIsConfirming(false)
    setError(err instanceof Error ? err : new Error(String(err)))
  }, [])

  const confirmSwap = useCallback(async () => {
    if (!isConnected || !address || !fromToken || !toToken || !amount) return
    reset()
    setIsSubmitting(true)

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
  ])

  /**
   * Path for Native ETH swaps: Fetches tx data from API, estimates gas on the exact
   * tx we're about to send, then sends via wallet. Gas estimate at execution time
   * ensures it matches the actual transaction (avoids dual-API-call mismatch).
   */
  async function executeEthPath(inputAmtWei: string, userAmtOutWei: string) {
    if (!address || !fromToken || !toToken) return

    // Calculate current timestamp (in seconds)
    const timestamp = Math.floor(Date.now() / 1000)
    // Calculate deadline as a timestamp N minutes in the future
    const deadlineUnix = timestamp + deadline * 60
    console.debug("[Slippage] executeEthPath: deadline", {
      deadlineProp: deadline,
      deadlineUnix,
      timestamp,
    })
    // API body must contain a proper 'timestamp'
    const body = {
      outputToken: toToken.address,
      inputAmt: inputAmtWei,
      userAmtOut: userAmtOutWei,
      sender: address,
      deadline: String(timestamp),
    }

    const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap/eth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await resp.json()
    if (!resp.ok || !data?.to || !data?.data) {
      const apiError = data?.error || "FastSwap API error"
      let errorMessage = apiError
      if (apiError.toLowerCase().includes("barter api error")) {
        errorMessage += `\n\nContext:\nInput token: ${fromToken.symbol} (${fromToken.address})\nOutput token: ${toToken.symbol} (${toToken.address})\nRequest body: ${JSON.stringify(body, null, 2)}`
      }
      throw new Error(errorMessage)
    }

    await getFreshGasFees()

    // Estimate gas on the exact tx we're about to send (single source of truth)
    let bufferedGas: bigint | undefined
    if (publicClient) {
      const estimated = await publicClient.estimateGas({
        account: address as `0x${string}`,
        to: data.to as `0x${string}`,
        data: data.data as `0x${string}`,
        value: BigInt(data.value || 0),
      })
      bufferedGas = (estimated * ETH_PATH_GAS_LIMIT_MULTIPLIER) / 100n
    }

    const txHash = await sendTransactionAsync({
      to: data.to as `0x${string}`,
      data: data.data,
      value: BigInt(data.value),
      gas: bufferedGas,
    })

    if (txHash) {
      setHash(txHash)
      setIsSubmitting(false)
    }
  }

  /**
   * Path for ERC20 swaps: Collects EIP-712 signature and posts to relayer.
   */
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

    setHash(result.txHash)
    setIsSubmitting(false)
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
