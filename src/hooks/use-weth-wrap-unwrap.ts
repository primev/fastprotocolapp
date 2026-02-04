"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useEstimateGas,
} from "wagmi"
import { parseUnits, type TransactionReceipt } from "viem"
import { WETH_ADDRESS } from "@/lib/swap-constants"
import { WETH_ABI } from "@/lib/weth-abi"
import { isWrapOperation, isUnwrapOperation } from "@/lib/weth-utils"
import { mainnet } from "wagmi/chains"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import { GAS_LIMIT_MULTIPLIER } from "@/hooks/use-broadcast-gas-price"

export function useWethWrapUnwrap({ fromToken, toToken, amount }: any) {
  const { address, isConnected } = useAccount()
  const [error, setError] = useState<Error | null>(null)
  const [internalHash, setInternalHash] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const isWrap = isWrapOperation(fromToken, toToken)
  const isUnwrap = isUnwrapOperation(fromToken, toToken)

  // Normalize amount input to Wei
  const amountInWei = useMemo(() => {
    if (!amount) return 0n
    const cleaned = amount.toString().replace(/,/g, "").trim()
    try {
      return parseUnits(cleaned, 18)
    } catch {
      return 0n
    }
  }, [amount])

  // --- GAS ESTIMATION ---
  const { data: rawEstimate, refetch: refetchEstimate } = useEstimateGas({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: isWrap ? "deposit" : "withdraw",
    args: isWrap ? [] : [amountInWei],
    value: isWrap ? amountInWei : undefined,
    account: address,
    query: {
      enabled: isConnected && !!address && amountInWei > 0n,
      refetchInterval: 12_000,
    },
  })

  // Apply safety buffer to gas limit
  const bufferedEstimate = useMemo(() => {
    if (!rawEstimate) return null
    return (rawEstimate * GAS_LIMIT_MULTIPLIER) / 100n
  }, [rawEstimate])

  const { data: wethBalance } = useBalance({
    address: isConnected ? address : undefined,
    token: WETH_ADDRESS,
  })

  const {
    writeContract,
    data: wagmiHash,
    isPending,
    error: writeError,
    reset: wagmiReset,
  } = useWriteContract()

  // Sync hash from wagmi to internal state
  useEffect(() => {
    if (wagmiHash) setInternalHash(wagmiHash)
  }, [wagmiHash])

  const { data: receipt, error: receiptError } = useWaitForTransactionReceipt({
    hash: internalHash as `0x${string}` | undefined,
  })

  // Handle final block confirmation logic
  const { isConfirming, reset: resetConfirmation } = useWaitForTxConfirmation({
    hash: internalHash ?? undefined,
    receipt: (receipt as TransactionReceipt | undefined) ?? undefined,
    mode: "status",
    onConfirmed: () => setIsSuccess(true),
    onError: (err: Error) => setError(err instanceof Error ? err : new Error(String(err))),
  })

  // Aggregate errors from contract writing and receipt fetching
  useEffect(() => {
    const rawError = writeError || receiptError
    if (rawError) {
      setError(rawError instanceof Error ? rawError : new Error(String(rawError)))
    }
  }, [writeError, receiptError])

  const reset = useCallback(() => {
    wagmiReset()
    resetConfirmation()
    setInternalHash(null)
    setIsSuccess(false)
    setError(null)
  }, [wagmiReset, resetConfirmation])

  // --- ACTIONS ---
  const wrap = useCallback(async () => {
    try {
      reset()
      writeContract({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "deposit",
        value: amountInWei,
        chain: mainnet,
        account: address,
        gas: bufferedEstimate ?? undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [address, amountInWei, writeContract, reset, bufferedEstimate])

  const unwrap = useCallback(async () => {
    if (amountInWei === 0n) {
      setError(new Error("Amount is required"))
      return
    }
    try {
      reset()
      if (wethBalance && wethBalance.value < amountInWei) {
        setError(new Error(`Insufficient WETH balance.`))
        return
      }
      writeContract({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "withdraw",
        args: [amountInWei],
        chain: mainnet,
        account: address,
        gas: bufferedEstimate ?? undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [address, amountInWei, writeContract, reset, wethBalance, bufferedEstimate])

  return {
    isWrap,
    isUnwrap,
    wrap,
    unwrap,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash: internalHash,
    reset,
    gasEstimate: bufferedEstimate,
    rawGasEstimate: rawEstimate,
    refetchEstimate,
  }
}
