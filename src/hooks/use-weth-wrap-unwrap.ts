"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi"
import { parseUnits, formatUnits } from "viem"
import { WETH_ADDRESS } from "@/lib/swap-constants"
import { WETH_ABI } from "@/lib/weth-abi"
import { isWrapOperation, isUnwrapOperation } from "@/lib/weth-utils"
import { mainnet } from "wagmi/chains"

export function useWethWrapUnwrap({ fromToken, toToken, amount }: any) {
  const { address, isConnected } = useAccount()
  const [error, setError] = useState<Error | null>(null)

  // Check WETH balance for unwrap operations
  const { data: wethBalance } = useBalance({
    address: isConnected ? address : undefined,
    token: WETH_ADDRESS,
  })

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

  useEffect(() => {
    if (writeError) {
      // Extract error message from wagmi error object
      let errorMessage = "Transaction failed"
      if (writeError instanceof Error) {
        errorMessage = writeError.message
      } else if (typeof writeError === "object" && writeError !== null) {
        const wagmiError = writeError as any
        errorMessage =
          wagmiError.shortMessage ||
          wagmiError.message ||
          wagmiError.details ||
          wagmiError.cause?.message ||
          (typeof wagmiError.cause === "string" ? wagmiError.cause : errorMessage)
      }

      // Provide more helpful error message for RPC failures
      if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("RPC") ||
        errorMessage.includes("endpoint") ||
        errorMessage.includes("network") ||
        errorMessage.toLowerCase().includes("fetch")
      ) {
        errorMessage =
          "Network error: Unable to connect to the blockchain. This could be due to:\n• Your internet connection\n• MetaMask RPC endpoint issues\n• Network congestion\n\nPlease check your connection and try again. If the issue persists, try:\n• Refreshing the page\n• Switching networks in MetaMask\n• Checking MetaMask's network settings"
      }

      setError(new Error(errorMessage))
    } else if (receiptError) {
      setError(receiptError as Error)
    } else if (!writeError && !hash) {
      setError(null)
    }
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
    if (!amount) {
      setError(new Error("Amount is required"))
      return
    }

    // Clean the amount string: remove commas, trim whitespace
    const cleanedAmount = amount.toString().replace(/,/g, "").trim()

    // Validate the cleaned amount
    const amountNum = Number(cleanedAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(new Error(`Invalid amount: ${cleanedAmount}`))
      return
    }

    try {
      reset()

      // Parse the cleaned amount to wei
      const amountInWei = parseUnits(cleanedAmount, 18)

      // Check balance before attempting unwrap (only if balance is available)
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
      })
    } catch (error) {
      setError(
        new Error(
          `Failed to parse amount: ${cleanedAmount}. ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }, [address, amount, writeContract, reset, wethBalance])

  return { isWrap, isUnwrap, wrap, unwrap, isPending, isConfirming, isSuccess, error, hash, reset }
}
