import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useAccount, useWaitForTransactionReceipt } from "wagmi"
import { getWalletClient } from "wagmi/actions"
import { type Address, type TransactionReceipt } from "viem"
import { config } from "@/lib/wagmi"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"
import type { TxConfirmationResult } from "@/hooks/use-wait-for-tx-confirmation"

export interface TestResult {
  success: boolean
  hash: string | null
}

export interface UseRPCTestReturn {
  isTesting: boolean
  testResult: TestResult | null
  test: () => void
  reset: () => void
}

// Helper function to check if error is a user rejection
function isUserRejection(error: any): boolean {
  if (!error) return false
  const errorMessage = error.message?.toLowerCase() || error.toString().toLowerCase() || ""
  return (
    errorMessage.includes("reject") ||
    errorMessage.includes("user rejected") ||
    errorMessage.includes("user denied") ||
    errorMessage.includes("user cancelled") ||
    errorMessage.includes("4001") || // MetaMask rejection code
    errorMessage.includes("action_cancelled")
  )
}

// Get clean error message for user rejection
function getRejectionMessage(): string {
  return "Transaction was rejected. The RPC test was cancelled."
}

export function useRPCTest(): UseRPCTestReturn {
  const { isConnected, address } = useAccount()
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined)
  const [isSending, setIsSending] = useState(false)
  const [isSendError, setIsSendError] = useState(false)
  const [sendError, setSendError] = useState<Error | null>(null)

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isConfirmError,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash })

  const onConfirmed = useCallback((result: TxConfirmationResult) => {
    const status = result.status
    if (!status) return
    setTestResult({ success: status.success, hash: status.hash })
    if (status.success) {
      toast.success("Test Successful", {
        description: "Fast Protocol RPC connection was successful. Transaction confirmed.",
      })
    } else {
      toast.error("Test Failed", {
        description: "RPC connection test failed.",
      })
    }
  }, [])

  const onConfirmationError = useCallback(() => {
    setTestResult({ success: false, hash: hash ?? "" })
    toast.error("Test Failed", {
      description: "RPC connection test failed.",
    })
  }, [hash])

  const { isConfirming: isConfirmingTx } = useWaitForTxConfirmation({
    hash: hash ?? undefined,
    receipt: (receipt as TransactionReceipt | undefined) ?? undefined,
    mode: "status",
    onConfirmed,
    onError: onConfirmationError,
  })

  // Update testing state based on transaction status and confirmation
  useEffect(() => {
    if (isSending || isConfirming || isConfirmingTx) setIsTesting(true)
    else if (isConfirmed || isSendError || isConfirmError) {
      if (!isConfirmingTx) setIsTesting(false)
    }
  }, [isSending, isConfirming, isConfirmingTx, isConfirmed, isSendError, isConfirmError])

  const resetSend = useCallback(() => {
    setHash(undefined)
    setIsSending(false)
    setIsSendError(false)
    setSendError(null)
  }, [])

  // Handle transaction errors
  useEffect(() => {
    if (isSendError && sendError) {
      const isRejection = isUserRejection(sendError)
      const errorMessage = isRejection
        ? getRejectionMessage()
        : sendError.message || "Failed to send transaction"

      setTestResult({
        success: false,
        hash: null,
      })

      toast.error(isRejection ? "Transaction Rejected" : "Test Failed", {
        description: errorMessage,
      })
      resetSend()
    }
  }, [isSendError, sendError, toast, resetSend])

  useEffect(() => {
    if (isConfirmError && confirmError) {
      const errorMessage = confirmError.message || "Transaction confirmation failed"
      setTestResult({
        success: false,
        hash: hash || null,
      })
      toast.error("Test Failed", {
        description: `RPC connection test failed: ${errorMessage}`,
      })
      resetSend()
    }
  }, [isConfirmError, confirmError, hash, toast, resetSend])

  const test = async () => {
    // Prevent starting a new test if actively sending or confirming
    if (isSending || isConfirming) {
      return
    }

    // Reset all state first
    setTestResult(null)
    resetSend()

    // Small delay to ensure cleanup completes and RPC is ready for next transaction
    await new Promise((resolve) => setTimeout(resolve, 300))

    if (!isConnected || !address) {
      toast.error("Wallet not connected", {
        description: "Please connect your wallet first.",
      })
      return
    }

    setIsSending(true)
    setIsSendError(false)
    setSendError(null)

    try {
      // Get wallet client from wagmi config
      const walletClient = await getWalletClient(config)

      if (!walletClient) {
        throw new Error("Wallet client not available")
      }

      // Send transaction using the wallet client
      const txHash = await walletClient.sendTransaction({
        to: address as Address,
        value: BigInt(0),
        maxPriorityFeePerGas: BigInt(0),
      } as any)
      setHash(txHash)
      setIsSending(false)
    } catch (error: any) {
      setIsSending(false)
      setIsSendError(true)
      setSendError(error)

      const isRejection = isUserRejection(error)
      const errorMessage = isRejection
        ? getRejectionMessage()
        : error?.message || "Failed to initiate transaction"

      console.error("Transaction error:", errorMessage, error)
      setTestResult({ success: false, hash: null })
      setIsTesting(false)

      // Reset state on error to allow retry
      setTimeout(() => {
        resetSend()
      }, 1000)
    }
  }

  const reset = () => {
    setTestResult(null)
    setIsTesting(false)
    resetSend()
    setHash(undefined)
  }

  return { isTesting, testResult, test, reset }
}
