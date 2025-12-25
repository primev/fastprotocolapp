import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/lib/contract-config"
import { useReadOnlyContractCall } from "./use-read-only-contract-call"

export interface UseGenesisSBTReturn {
  hasGenesisSBT: boolean
  tokenId: bigint | undefined
  isLoadingTokenId: boolean
  shouldShowFeedbackModal: boolean
  markFeedbackShown: () => void
}

/**
 * Hook to manage Genesis SBT state, tokenId, and contract reads
 */
export function useGenesisSBT(
  isConnected: boolean,
  address: string | undefined
): UseGenesisSBTReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [hasGenesisSBT, setHasGenesisSBT] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = localStorage.getItem("hasGenesisSBT")
    // Default to true so users who already minted (or first-time visitors) are not blocked by the popup
    return stored ? stored === "true" : true
  })
  const [tokenIdFromQuery, setTokenIdFromQuery] = useState<string | null>(null)
  const [fetchedTokenId, setFetchedTokenId] = useState<bigint | undefined>(undefined)
  const hasProcessedQueryParam = useRef(false)
  const hasProcessedMintFeedback = useRef(false)

  // Memoize args to prevent unnecessary refetches
  const contractArgs = useMemo(() => (address ? [address] : []), [address])

  // Use the read-only contract call hook
  const {
    data: contractTokenId,
    isLoading: isLoadingTokenId,
    error: tokenIdError,
  } = useReadOnlyContractCall<bigint>({
    contractAddress: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getTokenIdByAddress",
    args: contractArgs,
    enabled: isConnected && !!address,
  })

  // Handle query params and process contract result
  useEffect(() => {
    if (!isConnected || !address) {
      setFetchedTokenId(undefined)
      setTokenIdFromQuery(null) // Clear query tokenId when disconnected
      return
    }

    // Handle tokenId from query params (post-mint redirect)
    const tokenIdParam = searchParams.get("tokenId")
    if (tokenIdParam && !hasProcessedQueryParam.current) {
      setTokenIdFromQuery(tokenIdParam)
      localStorage.setItem("genesisSBTTokenId", tokenIdParam)
      hasProcessedQueryParam.current = true

      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete("tokenId")
      router.replace(newUrl.pathname + newUrl.search, { scroll: false })
    }

    // Process contract result
    if (tokenIdError) {
      console.error("Error reading tokenId:", tokenIdError)
      setFetchedTokenId(undefined)
      return
    }

    if (!isLoadingTokenId && contractTokenId !== null && contractTokenId !== undefined) {
      const fetchedValue = contractTokenId
      console.log(
        "Fetched tokenId from contract:",
        fetchedValue?.toString(),
        "for address:",
        address
      )

      const tokenIdFromLocalStorage = localStorage.getItem("genesisSBTTokenId")

      // If contract value matches stored value, clear from localStorage.
      // This means that the contract has been updated and the user has minted the SBT.
      if (
        tokenIdFromLocalStorage &&
        fetchedValue !== BigInt(0) &&
        fetchedValue.toString() === tokenIdFromLocalStorage
      ) {
        localStorage.removeItem("genesisSBTTokenId")
        setFetchedTokenId(fetchedValue)
      } else if (fetchedValue !== BigInt(0)) {
        // Use the value from the contract
        setFetchedTokenId(fetchedValue)
      } else {
        // No token found in contract
        setFetchedTokenId(undefined)
      }
    } else if (!isLoadingTokenId) {
      // No token found
      setFetchedTokenId(undefined)
    }
  }, [isConnected, address, contractTokenId, isLoadingTokenId, tokenIdError, searchParams, router])

  // Determine final tokenId: query param > contract value
  // Only use tokenId if wallet is connected
  const tokenId = useMemo(() => {
    if (!isConnected || !address) return undefined
    if (tokenIdFromQuery) return BigInt(tokenIdFromQuery)
    if (fetchedTokenId !== undefined && fetchedTokenId !== BigInt(0)) return fetchedTokenId
    return undefined
  }, [tokenIdFromQuery, fetchedTokenId, isConnected, address])

  // Update hasGenesisSBT based on tokenId
  // Only update when we have a definitive answer from the contract (not during loading)
  useEffect(() => {
    // Don't update if wallet is not connected - preserve state
    if (!isConnected || !address) {
      return
    }

    // Wait for contract check to complete before making any updates
    // This prevents flickering by not updating state during loading
    if (isLoadingTokenId) {
      return
    }

    // Now we have a definitive answer - update based on contract result
    if (tokenId !== undefined && tokenId !== BigInt(0)) {
      setHasGenesisSBT(true)
      localStorage.setItem("hasGenesisSBT", "true")
    } else {
      // Contract check completed and no token found
      setHasGenesisSBT(false)
    }
  }, [tokenId, isLoadingTokenId, isConnected, address])

  // Determine if feedback modal should be shown
  const [shouldShowFeedbackModal, setShouldShowFeedbackModal] = useState(false)

  useEffect(() => {
    if (tokenIdFromQuery && tokenId !== undefined && tokenId !== BigInt(0)) {
      if (!hasProcessedMintFeedback.current) {
        hasProcessedMintFeedback.current = true
        setShouldShowFeedbackModal(true)
      }
    }
  }, [tokenIdFromQuery, tokenId])

  const markFeedbackShown = () => {
    hasProcessedMintFeedback.current = true
    setShouldShowFeedbackModal(false)
  }

  return {
    hasGenesisSBT,
    tokenId,
    isLoadingTokenId,
    shouldShowFeedbackModal,
    markFeedbackShown,
  }
}
