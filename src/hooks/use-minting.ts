import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Address, PublicClient, TransactionReceipt } from "viem"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { toast } from "sonner"
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/lib/contract-config"
import { parseTokenIdFromReceipt } from "@/lib/onboarding-utils"
import { useWaitForTxConfirmation } from "@/hooks/use-wait-for-tx-confirmation"

export interface UseMintingProps {
  isConnected: boolean
  address: Address | undefined
  publicClient: PublicClient | undefined
}

export interface UseMintingReturn {
  isMinting: boolean
  alreadyMinted: boolean
  existingTokenId: string | undefined
  handleMintSbt: () => Promise<void>
}

/**
 * Hook to manage minting transaction state and existing token checking
 */
export function useMinting({
  isConnected,
  address,
  publicClient,
}: UseMintingProps): UseMintingReturn {
  const router = useRouter()
  const [isMinting, setIsMinting] = useState(false)
  const [alreadyMinted, setAlreadyMinted] = useState(false)
  const [existingTokenId, setExistingTokenId] = useState<string | undefined>(undefined)

  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    isError: isWriteError,
    error: writeError,
  } = useWriteContract()

  const {
    data: receipt,
    isLoading: isConfirming,
    isError: isConfirmError,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash })

  const onConfirmed = useCallback(
    (result: { receipt?: TransactionReceipt }) => {
      const receiptToUse = result.receipt
      if (!receiptToUse) return
      const tokenId = parseTokenIdFromReceipt(receiptToUse)
      if (tokenId && hash) {
        localStorage.setItem("claimTxHash", hash)
        router.push(`/dashboard?tokenId=${tokenId.toString()}`)
      }
    },
    [hash, router]
  )

  const { isConfirming: isConfirmingTx } = useWaitForTxConfirmation({
    hash: hash ?? undefined,
    receipt: (receipt as TransactionReceipt | undefined) ?? undefined,
    mode: "receipt",
    onConfirmed,
  })

  // Check if user already has a token minted on page load
  useEffect(() => {
    const checkExistingToken = async () => {
      if (!address || !publicClient) {
        setAlreadyMinted(false)
        setExistingTokenId(undefined)
        return
      }

      try {
        const tokenId = (await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: "getTokenIdByAddress",
          args: [address],
          blockTag: "latest",
        } as any)) as bigint

        // Check if tokenId is valid (not zero)
        if (tokenId && tokenId > BigInt(0)) {
          setAlreadyMinted(true) // Todo: Change to true for production
          setExistingTokenId(tokenId.toString())
        } else {
          setAlreadyMinted(false)
          setExistingTokenId(undefined)
        }
      } catch (error) {
        console.error("Error checking existing token:", error)
        setAlreadyMinted(false)
        setExistingTokenId(undefined)
      }
    }

    checkExistingToken()
  }, [address, publicClient])

  // Update minting state based on transaction status
  useEffect(() => {
    if (isWriting || isConfirming || isConfirmingTx) {
      setIsMinting(true)
      return
    }

    if (isWriteError || isConfirmError) {
      setIsMinting(false)
      const error = writeError || confirmError

      if (error?.message?.toLowerCase().includes("user")) {
        toast.error("Claiming Failed", {
          description: "User cancelled the transaction",
        })
        return
      } else {
        toast.error("Claiming Failed", {
          description: "Check RPC connection and try again",
        })
        return
      }
    }
  }, [
    isWriting,
    isConfirming,
    isConfirmingTx,
    isWriteError,
    isConfirmError,
    writeError,
    confirmError,
  ])

  const handleMintSbt = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first")
      return
    }

    try {
      setIsMinting(true)

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: "mint",
      } as unknown as any)
    } catch (error: any) {
      setIsMinting(false)

      toast.error("Transaction Failed", {
        description: error?.message || "An unknown error occurred",
      })
    }
  }

  return {
    isMinting,
    alreadyMinted,
    existingTokenId,
    handleMintSbt,
  }
}
