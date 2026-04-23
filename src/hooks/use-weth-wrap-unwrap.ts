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
import { reportClientError } from "@/lib/report-client-error"

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
    writeContractAsync,
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
    onError: (err: Error) => {
      reportClientError(err, {
        source: "use-weth-wrap-unwrap.waitForTxConfirmation",
        hash: internalHash,
        walletAddress: address,
        op: isWrap ? "wrap" : isUnwrap ? "unwrap" : "unknown",
      })
      setError(err instanceof Error ? err : new Error(String(err)))
    },
  })

  // Aggregate errors from contract writing and receipt fetching
  useEffect(() => {
    const rawError = writeError || receiptError
    if (rawError) {
      reportClientError(rawError, {
        source: "use-weth-wrap-unwrap.writeOrReceiptError",
        hash: internalHash,
        walletAddress: address,
        op: isWrap ? "wrap" : isUnwrap ? "unwrap" : "unknown",
        kind: writeError ? "write" : "receipt",
      })
      setError(rawError instanceof Error ? rawError : new Error(String(rawError)))
    }
  }, [writeError, receiptError, internalHash, address, isWrap, isUnwrap])

  const reset = useCallback(() => {
    wagmiReset()
    resetConfirmation()
    setInternalHash(null)
    setIsSuccess(false)
    setError(null)
  }, [wagmiReset, resetConfirmation])

  // --- ACTIONS ---
  const wrap = useCallback(async (): Promise<string> => {
    reset()
    try {
      const hash = await writeContractAsync({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "deposit",
        value: amountInWei,
        chain: mainnet,
        account: address,
      })
      return hash
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }, [address, amountInWei, writeContractAsync, reset])

  const unwrap = useCallback(async (): Promise<string> => {
    if (amountInWei === 0n) {
      const err = new Error("Amount is required")
      setError(err)
      throw err
    }
    if (wethBalance && wethBalance.value < amountInWei) {
      const err = new Error("Insufficient WETH balance.")
      setError(err)
      throw err
    }
    reset()
    try {
      const hash = await writeContractAsync({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "withdraw",
        args: [amountInWei],
        chain: mainnet,
        account: address,
      })
      return hash
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }, [address, amountInWei, writeContractAsync, reset, wethBalance])

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
