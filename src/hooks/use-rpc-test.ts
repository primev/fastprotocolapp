import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useAccount, useWaitForTransactionReceipt } from "wagmi"
import { getWalletClient } from "wagmi/actions"
import { type Address } from "viem"
import { config } from "@/lib/wagmi"
import {
  pollDatabaseForStatus,
  checkTransactionReceiptExists,
} from "@/lib/transaction-receipt-utils"

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
  const [isQueryingAPI, setIsQueryingAPI] = useState(false)
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined)
  const [isSending, setIsSending] = useState(false)
  const [isSendError, setIsSendError] = useState(false)
  const [sendError, setSendError] = useState<Error | null>(null)
  const statusProcessedRef = useRef(false)
  const pollingAbortRef = useRef<AbortController | null>(null)

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isConfirmError,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash })

  // Log receipt when available
  useEffect(() => {
    if (receipt) {
      console.log("Transaction receipt:", receipt)
    }
  }, [receipt])

  // Update testing state based on transaction status and API query
  useEffect(() => {
    if (isSending || isConfirming || isQueryingAPI) setIsTesting(true)
    else if (isConfirmed || isSendError || isConfirmError) {
      if (!isQueryingAPI) setIsTesting(false)
    }
  }, [isSending, isConfirming, isConfirmed, isSendError, isConfirmError, isQueryingAPI])

  const resetSend = () => {
    setHash(undefined)
    setIsSending(false)
    setIsSendError(false)
    setSendError(null)
  }

  // Race condition: Wait for txReceipt and poll DB simultaneously
  useEffect(() => {
    if (!hash || statusProcessedRef.current) return

    statusProcessedRef.current = false
    let isProcessing = false

    const abortController = new AbortController()
    pollingAbortRef.current = abortController

    const processStatusResult = (
      result: { success: boolean; hash: string } | null,
      source: string
    ) => {
      if (isProcessing || !result || abortController.signal.aborted) {
        return
      }

      isProcessing = true
      statusProcessedRef.current = true
      setIsQueryingAPI(false)
      setIsTesting(false)
      console.log(`Status received from ${source}:`, result)

      setTestResult({
        success: result.success,
        hash: result.hash,
      })

      if (result.success) {
        toast.success("Test Successful", {
          description: "Fast Protocol RPC connection was successful. Transaction confirmed.",
        })
      } else {
        toast.error("Test Failed", {
          description: "RPC connection test failed.",
        })
      }

      abortController.abort()
    }

    // Start database polling immediately
    setIsQueryingAPI(true)
    pollDatabaseForStatus(hash, abortController.signal)
      .then((dbResult) => {
        if (!abortController.signal.aborted && dbResult) {
          processStatusResult(dbResult, "db")
        }
      })
      .catch((error) => {
        if (!abortController.signal.aborted) {
          console.error("Database polling error:", error)
          setIsQueryingAPI(false)
          setIsTesting(false)
          setTestResult({
            success: false,
            hash: hash,
          })
          toast.error("Test Failed", {
            description: "RPC connection test failed.",
          })
        }
      })

    // Watch for wagmi receipt and query database when available
    const checkWagmiReceipt = async () => {
      if (receipt && !abortController.signal.aborted) {
        try {
          const exists = await checkTransactionReceiptExists(hash, abortController.signal)
          if (exists && !abortController.signal.aborted) {
            processStatusResult({ success: true, hash }, "wagmi")
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error("Database query failed:", error)
            setIsQueryingAPI(false)
            setIsTesting(false)
            setTestResult({
              success: false,
              hash: hash,
            })
            toast.error("Test Failed", {
              description: "RPC connection test failed.",
            })
          }
        }
      }
    }

    checkWagmiReceipt()
    const receiptCheckInterval = setInterval(checkWagmiReceipt, 100)

    return () => {
      clearInterval(receiptCheckInterval)
      if (pollingAbortRef.current) {
        pollingAbortRef.current.abort()
        pollingAbortRef.current = null
      }
    }
  }, [hash, receipt])

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
      console.log("Test already in progress, please wait...")
      return
    }

    // Reset all state first
    setTestResult(null)
    setIsQueryingAPI(false)
    statusProcessedRef.current = false
    if (pollingAbortRef.current) {
      pollingAbortRef.current.abort()
      pollingAbortRef.current = null
    }
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
    setIsQueryingAPI(false)
    resetSend()
    setHash(undefined)
    statusProcessedRef.current = false
    if (pollingAbortRef.current) {
      pollingAbortRef.current.abort()
      pollingAbortRef.current = null
    }
  }

  return { isTesting, testResult, test, reset }
}
