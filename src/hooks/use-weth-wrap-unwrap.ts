"use client"

import { useState, useEffect, useCallback } from "react"
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useEstimateFeesPerGas,
  useGasPrice,
} from "wagmi"
import { parseUnits, formatUnits } from "viem"
import { WETH_ADDRESS } from "@/lib/swap-constants"
import { WETH_ABI } from "@/lib/weth-abi"
import { isWrapOperation, isUnwrapOperation } from "@/lib/weth-utils"
import { mainnet } from "wagmi/chains"
import { getTransactionErrorMessage } from "@/lib/transaction-errors"

/**
 * useWethWrapUnwrap
 * * Specifically handles the logic for converting ETH to WETH (deposit)
 * and WETH to ETH (withdraw).
 * * Error handling is funneled through the centralized utility,
 * updating the local 'error' state for the UI to display.
 */
export function useWethWrapUnwrap({ fromToken, toToken, amount }: any) {
  const { address, isConnected } = useAccount()
  const [error, setError] = useState<Error | null>(null)

  // --- GAS CONFIGURATION ---
  const { data: feeData } = useEstimateFeesPerGas()
  const { data: legacyGasPrice } = useGasPrice()

  const gasFees =
    feeData?.maxFeePerGas != null && feeData?.maxPriorityFeePerGas != null
      ? {
          maxFeePerGas: (feeData.maxFeePerGas * 120n) / 100n,
          maxPriorityFeePerGas: 0n,
        }
      : legacyGasPrice != null
        ? { gasPrice: legacyGasPrice }
        : undefined

  // --- BALANCE CHECK ---
  const { data: wethBalance } = useBalance({
    address: isConnected ? address : undefined,
    token: WETH_ADDRESS,
  })

  const isWrap = isWrapOperation(fromToken, toToken)
  const isUnwrap = isUnwrapOperation(fromToken, toToken)
  const operationType = isWrap ? "wrap" : "unwrap"

  // --- WAGMI CONTRACT HOOKS ---
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset: wagmiReset,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash })

  /**
   * Effect: Monitors Wagmi hook errors and syncs them to local state.
   * Uses centralized utility to format messages.
   */
  useEffect(() => {
    const rawError = writeError || receiptError
    if (rawError) {
      const cleanMessage = getTransactionErrorMessage(rawError, operationType)
      setError(new Error(cleanMessage))
    } else if (!hash) {
      // Clear error if we don't have an active transaction
      setError(null)
    }
  }, [writeError, receiptError, hash, operationType])

  const reset = useCallback(() => {
    wagmiReset()
    setError(null)
  }, [wagmiReset])

  /**
   * Wrap (ETH -> WETH)
   */
  const wrap = useCallback(() => {
    try {
      reset()
      writeContract({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "deposit",
        value: parseUnits(amount, 18),
        chain: mainnet,
        account: address,
        ...gasFees,
      })
    } catch (err) {
      setError(new Error(getTransactionErrorMessage(err, "wrap")))
    }
  }, [address, amount, writeContract, reset, gasFees])

  /**
   * Unwrap (WETH -> ETH)
   */
  const unwrap = useCallback(() => {
    if (!amount) {
      setError(new Error("Amount is required"))
      return
    }

    const cleanedAmount = amount.toString().replace(/,/g, "").trim()
    const amountNum = Number(cleanedAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(new Error(`Invalid amount: ${cleanedAmount}`))
      return
    }

    try {
      reset()
      const amountInWei = parseUnits(cleanedAmount, 18)

      // Pre-flight balance check
      if (wethBalance && wethBalance.value < amountInWei) {
        const balanceFormatted = formatUnits(wethBalance.value, 18)
        setError(
          new Error(
            `Insufficient WETH balance. You have ${balanceFormatted} WETH but trying to unwrap ${cleanedAmount} WETH`
          )
        )
        return
      }

      writeContract({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "withdraw",
        args: [amountInWei],
        chain: mainnet,
        account: address,
        ...gasFees,
      })
    } catch (err) {
      setError(new Error(getTransactionErrorMessage(err, "unwrap")))
    }
  }, [address, amount, writeContract, reset, wethBalance, gasFees])

  return {
    isWrap,
    isUnwrap,
    wrap,
    unwrap,
    isPending,
    isConfirming,
    isSuccess,
    error, // This is the state your modal uses for the error message
    hash,
    reset,
  }
}
