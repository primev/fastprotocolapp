"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseUnits } from "viem"
import { WETH_ADDRESS } from "@/lib/swap-constants"
import { WETH_ABI } from "@/lib/weth-abi"
import {
  isWrapOperation,
  isUnwrapOperation,
  estimateWrapGas,
  estimateUnwrapGas,
} from "@/lib/weth-utils"
import type { Token } from "@/types/swap"

interface UseWethWrapUnwrapParams {
  fromToken: Token | undefined
  toToken: Token | undefined
  amount: string
  enabled?: boolean
}

interface UseWethWrapUnwrapReturn {
  isWrap: boolean
  isUnwrap: boolean
  gasEstimate: bigint | null
  isLoadingGas: boolean
  wrap: () => void
  unwrap: () => void
  isPending: boolean
  isConfirming: boolean
  isSuccess: boolean
  error: Error | null
  hash: `0x${string}` | undefined
}

/**
 * Hook for handling WETH wrap/unwrap operations
 * Detects wrap/unwrap pairs and provides transaction execution functions
 */
export function useWethWrapUnwrap({
  fromToken,
  toToken,
  amount,
  enabled = true,
}: UseWethWrapUnwrapParams): UseWethWrapUnwrapReturn {
  const { address, isConnected } = useAccount()
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null)
  const [isLoadingGas, setIsLoadingGas] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isWrap = isWrapOperation(fromToken, toToken)
  const isUnwrap = isUnwrapOperation(fromToken, toToken)

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  })

  // Update error state when write or receipt errors occur
  // Only set error if a transaction was actually attempted (hash exists or was pending)
  useEffect(() => {
    // Only show errors if we have a hash (transaction was submitted) or was pending
    // This prevents showing errors for validation issues before user confirms
    if (writeError && (hash || isPending)) {
      setError(writeError instanceof Error ? writeError : new Error(String(writeError)))
    } else if (receiptError) {
      // Receipt errors always indicate a submitted transaction failed
      setError(receiptError instanceof Error ? receiptError : new Error(String(receiptError)))
    } else if (!writeError && !receiptError) {
      // Clear error if both are cleared
      setError(null)
    }
  }, [writeError, receiptError, hash, isPending])

  // Estimate gas when amount or tokens change
  useEffect(() => {
    if (!enabled || !isConnected || !address || !amount || parseFloat(amount) <= 0) {
      setGasEstimate(null)
      return
    }

    if (isWrap) {
      setIsLoadingGas(true)
      estimateWrapGas(amount, address)
        .then((estimate) => {
          setGasEstimate(estimate) // Will be null if error
          setIsLoadingGas(false)
        })
        .catch((err) => {
          console.error("Failed to estimate wrap gas:", err)
          setGasEstimate(null) // Return null instead of fallback
          setIsLoadingGas(false)
        })
    } else if (isUnwrap) {
      setIsLoadingGas(true)
      estimateUnwrapGas(amount, address)
        .then((estimate) => {
          setGasEstimate(estimate) // Will be null if insufficient balance or error
          setIsLoadingGas(false)
        })
        .catch((err) => {
          console.error("Failed to estimate unwrap gas:", err)
          setGasEstimate(null) // Return null instead of fallback
          setIsLoadingGas(false)
        })
    } else {
      setGasEstimate(null)
    }
  }, [enabled, isConnected, address, amount, isWrap, isUnwrap])

  const wrap = useCallback(() => {
    if (!isConnected || !address || !amount || parseFloat(amount) <= 0) {
      setError(new Error("Invalid wrap parameters"))
      return
    }

    try {
      const amountInWei = parseUnits(amount, 18)

      writeContract({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "deposit",
        value: amountInWei,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [isConnected, address, amount, writeContract])

  const unwrap = useCallback(() => {
    if (!isConnected || !address || !amount || parseFloat(amount) <= 0) {
      setError(new Error("Invalid unwrap parameters"))
      return
    }

    try {
      const amountInWei = parseUnits(amount, 18)

      writeContract({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "withdraw",
        args: [amountInWei],
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [isConnected, address, amount, writeContract])

  return {
    isWrap,
    isUnwrap,
    gasEstimate,
    isLoadingGas,
    wrap,
    unwrap,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  }
}
