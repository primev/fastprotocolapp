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
import { FASTSWAP_API_BASE } from "@/lib/network-config"
import { fetchBarterRoute } from "@/lib/barter-api"
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
      console.log("fromToken.address", fromToken.address)
      console.log("toToken.address", toToken.address)
      console.log("source", source)
      console.log("target", target)

      const { outputAmount } = await fetchBarterRoute(source, target, inputAmtWei)
      const slippageBps = BigInt(Math.floor(parseFloat(slippage || "0.5") * 100))
      const userAmtOutWei = (
        (BigInt(outputAmount) * (BigInt(10000) - slippageBps)) /
        BigInt(10000)
      ).toString()
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
    slippage,
    deadline,
    handleSwapError,
    reset,
    isNonceLoading,
  ])

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
      if (apiError.toLowerCase().includes("barter api error")) {
        errorMessage += `\n\nContext:\nInput token: ${fromToken.symbol} (${fromToken.address})\nOutput token: ${toToken.symbol} (${toToken.address})\nSlippage: ${slippage}\nMinimun Output: ${userAmtOutWei}\nDeadline (minutes): ${deadline}`
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

    const body = {
      ...intentData.intent,
      inputAmt: inputAmtWei,
      userAmtOut: userAmtOutWei,
      deadline: intentData.intent.deadline.toString(),
      nonce: intentData.intent.nonce.toString(),
      signature: intentData.signature,
    }

    // {
    //   "user": "0xUserAddress",
    //   "inputToken": "0xUSDC...",
    //   "outputToken": "0xWETH...",
    //   "inputAmt": 1000000000,
    //   "userAmtOut": 500000000000000000,
    //   "recipient": "0xRecipientAddress",
    //   "deadline": 1700000000,
    //   "nonce": 1,
    //   "signature": "0x..."
    // }

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
    isNonceLoading,
  }
}
