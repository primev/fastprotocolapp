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
import { parseUnits, formatUnits, type TransactionReceipt } from "viem"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { fetchEthPathTxAndEstimate } from "@/lib/eth-path-tx"
import type { Token } from "@/types/swap"

interface UseSwapConfirmationParams {
  fromToken: Token | undefined
  toToken: Token | undefined
  amount: string
  minAmountOut: string
  slippage: string
  deadline: number
  onSuccess?: () => void
}

/** Options for confirmSwap. Used by Permit path to show toast before relayer returns. */
export interface ConfirmSwapOptions {
  onPendingHash?: (placeholderHash: string) => void
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
  slippage,
  deadline,
  onSuccess,
}: UseSwapConfirmationParams) {
  const { isConnected, address } = useAccount()
  const { getFreshGasFees } = useBroadcastGasPrice()
  const publicClient = usePublicClient({ chainId: mainnet.id })

  const { createIntentSignature } = useSwapIntent()
  const {
    getFreshNonce,
    releaseNonce,
    syncFromChain,
    isLoading: isNonceLoading,
  } = usePermit2Nonce()
  const { sendTransactionAsync } = useSendTransaction()

  // --- Transaction State ---
  const [isSigning, setIsSigning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Wagmi receipt hook used as a data source for the race-condition confirmation hook
  const { data: receipt, error: receiptError } = useWaitForTransactionReceipt({
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
    receiptError,
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

  const confirmSwap = useCallback(
    async (options?: ConfirmSwapOptions): Promise<string> => {
      if (!isConnected || !address || !fromToken || !toToken || !amount) {
        throw new Error("Missing required parameters for swap")
      }

      // Guard: Prevent Permit path execution if bitmap isn't loaded yet (race condition)
      const isEthPath = fromToken.address === ZERO_ADDRESS && toToken.address !== WETH_ADDRESS
      if (!isEthPath && isNonceLoading) {
        throw new Error("Initializing secure swap (Permit2)... please try again in a moment.")
      }

      reset()
      setIsSubmitting(true)

      const amountClean = amount.replace(/,/g, "")
      const inputAmtWei = parseUnits(amountClean, fromToken.decimals).toString()

      const source =
        fromToken.address === ZERO_ADDRESS
          ? (WETH_ADDRESS as `0x${string}`)
          : (fromToken.address as `0x${string}`)
      const target =
        toToken.address === ZERO_ADDRESS
          ? (ZERO_ADDRESS as `0x${string}`)
          : (toToken.address as `0x${string}`)

      try {
        // Use minAmountOut from Uniswap quote (already has slippage applied)
        const minAmountClean = minAmountOut?.replace(/,/g, "").trim()
        if (!minAmountClean || parseFloat(minAmountClean) <= 0) {
          throw new Error("Invalid minimum output amount")
        }
        const userAmtOutWei = parseUnits(minAmountClean, toToken.decimals).toString()

        if (fromToken.address === ZERO_ADDRESS && toToken.address !== WETH_ADDRESS) {
          return await executeEthPath(inputAmtWei, userAmtOutWei)
        } else {
          return await executePermitPath(inputAmtWei, userAmtOutWei, options)
        }
      } catch (err) {
        handleSwapError(err)
        throw err
      }
    },
    [
      isConnected,
      address,
      fromToken,
      toToken,
      amount,
      minAmountOut,
      slippage,
      deadline,
      handleSwapError,
      reset,
      isNonceLoading,
    ]
  )

  /**
   * Path for Native ETH swaps: Fetches tx data from API, estimates gas on the exact
   * tx we're about to send, then sends via wallet. Uses shared fetchEthPathTxAndEstimate
   * for both display (useEthPathGasEstimate) and execution.
   */
  async function executeEthPath(inputAmtWei: string, userAmtOutWei: string) {
    if (!address || !fromToken || !toToken || !publicClient) {
      throw new Error("Wallet connection required. Please reconnect and try again.")
    }

    const deadlineUnix = Math.floor(Date.now() / 1000) + deadline * 60

    let result
    console.log("body", {
      outputToken: toToken.address,
      inputAmt: inputAmtWei,
      userAmtOut: userAmtOutWei,
      sender: address,
      deadline: String(deadlineUnix),
    })
    try {
      result = await fetchEthPathTxAndEstimate(
        {
          outputToken: toToken.address,
          inputAmt: inputAmtWei,
          userAmtOut: userAmtOutWei,
          sender: address,
          deadline: String(deadlineUnix),
        },
        publicClient,
        address as `0x${string}`
      )
    } catch (err) {
      const apiError = err instanceof Error ? err.message : "FastSwap API error"
      let errorMessage = apiError
      console.log("apiError", apiError)
      if (apiError.toLowerCase().includes("api error")) {
        errorMessage += `\n\nContext:\nInput token: ${fromToken.symbol} (${fromToken.address})\nOutput token: ${toToken.symbol} (${toToken.address})\nSlippage: ${slippage}\nMinimum Output: ${userAmtOutWei}\nDeadline (minutes): ${deadline}`
      }
      throw new Error(errorMessage)
    }

    await getFreshGasFees()

    const bufferedGas = (result.gasEstimate * ETH_PATH_GAS_LIMIT_MULTIPLIER) / 100n

    const txHash = await sendTransactionAsync({
      to: result.to as `0x${string}`,
      data: result.data,
      value: BigInt(result.value),
      gas: bufferedGas,
    })

    setHash(txHash)
    setIsSubmitting(false)
    return txHash
  }

  /**
   * Path for ERC20 swaps: Collects EIP-712 signature and posts to relayer.
   * Calls onPendingHash right after signature so the UI can show the toast before the API returns.
   */
  async function executePermitPath(
    inputAmtWei: string,
    userAmtOutWei: string,
    options?: ConfirmSwapOptions
  ): Promise<string> {
    if (!fromToken || !toToken) {
      throw new Error("Missing token parameters for permit path")
    }
    setIsSubmitting(false)
    setIsSigning(true)

    const nonce = getFreshNonce()
    const tokenInAddress = fromToken.address === ZERO_ADDRESS ? WETH_ADDRESS : fromToken.address
    const tokenOutAddress = toToken.address

    const minAmountOutFormatted = formatUnits(BigInt(userAmtOutWei), toToken.decimals)
    const intentData = await createIntentSignature(
      tokenInAddress as `0x${string}`,
      tokenOutAddress as `0x${string}`,
      amount,
      minAmountOutFormatted,
      nonce,
      fromToken.decimals,
      toToken.decimals,
      deadline
    )

    setIsSigning(false)
    setIsSubmitting(true)

    const placeholderHash = `pending-${Date.now()}-${nonce}`
    options?.onPendingHash?.(placeholderHash)

    const body = {
      ...intentData.intent,
      inputAmt: inputAmtWei,
      userAmtOut: userAmtOutWei,
      deadline: intentData.intent.deadline.toString(),
      nonce: intentData.intent.nonce.toString(),
      signature: intentData.signature,
      slippage: (parseFloat(slippage || "0.5") || 0.5).toFixed(1),
    }

    const resp = await fetch("/api/fastswap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const result = await resp.json()
    console.log("[Permit Path] fastswap response:", { status: resp.status, result })
    if (!resp.ok || !result?.txHash) {
      releaseNonce(nonce)
      const rawError = result?.error || "FastSwap API error"
      const errorMessage = `${rawError}\n\nContext:\nInput token: ${fromToken.symbol} (${fromToken.address})\nOutput token: ${toToken.symbol} (${toToken.address})\nSlippage: ${slippage}\nMinimum Output: ${userAmtOutWei}\nDeadline (minutes): ${deadline}`
      throw new Error(errorMessage)
    }

    setHash(result.txHash)
    setIsSubmitting(false)
    return result.txHash
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
    isNonceLoading,
  }
}
