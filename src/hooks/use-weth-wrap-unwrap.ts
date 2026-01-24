"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseUnits } from "viem"
import { WETH_ADDRESS } from "@/lib/swap-constants"
import { WETH_ABI } from "@/lib/weth-abi"
import { isWrapOperation, isUnwrapOperation } from "@/lib/weth-utils"
import { mainnet } from "wagmi/chains"

export function useWethWrapUnwrap({ fromToken, toToken, amount }: any) {
  const { address, isConnected } = useAccount()
  const [error, setError] = useState<Error | null>(null)

  const isWrap = isWrapOperation(fromToken, toToken)
  const isUnwrap = isUnwrapOperation(fromToken, toToken)

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

  // Sync internal Wagmi errors to your local error state
  useEffect(() => {
    if (writeError) setError(writeError as Error)
    else if (receiptError) setError(receiptError as Error)
    // If there's no writeError and no hash, it means reset() was likely called
    else if (!writeError && !hash) setError(null)
  }, [writeError, receiptError, hash])

  const reset = useCallback(() => {
    wagmiReset()
    setError(null)
  }, [wagmiReset])

  const wrap = useCallback(() => {
    reset()
    writeContract({
      address: WETH_ADDRESS,
      abi: WETH_ABI,
      functionName: "deposit",
      value: parseUnits(amount, 18),
      chain: mainnet,
      account: address,
    })
  }, [address, amount, writeContract, reset])

  const unwrap = useCallback(() => {
    reset()
    writeContract({
      address: WETH_ADDRESS,
      abi: WETH_ABI,
      functionName: "withdraw",
      args: [parseUnits(amount, 18)],
      chain: mainnet,
      account: address,
    })
  }, [address, amount, writeContract, reset])

  return { isWrap, isUnwrap, wrap, unwrap, isPending, isConfirming, isSuccess, error, hash, reset }
}
