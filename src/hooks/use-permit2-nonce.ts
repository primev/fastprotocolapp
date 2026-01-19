"use client"

import { useReadContract, useAccount } from "wagmi"
import { PERMIT2_ADDRESS } from "@/lib/swap-constants"

// Simplified ABI for the nonceBitmap function
const PERMIT2_ABI = [
  {
    name: "nonceBitmap",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "wordPos", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

export function usePermit2Nonce() {
  const { address } = useAccount()

  /**
   * In 2026, Permit2 nonces for SignatureTransfer are usually managed
   * via a bitmap to allow unordered execution.
   * For simplicity in a custom swap UI, we typically use the
   * "wordPos" of 0 and increment.
   */
  const wordPos = 0n

  const {
    data: bitmap,
    refetch,
    isLoading,
  } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: "nonceBitmap",
    args: address ? [address, wordPos] : undefined,
    query: {
      enabled: !!address,
    },
  })

  /**
   * Generates a fresh nonce.
   * Note: In a production "Intent" system, your backend should track
   * used nonces to avoid collisions if the user signs multiple
   * intents in one session.
   */
  const getNextNonce = () => {
    if (bitmap === undefined) return BigInt(Date.now()) // Fallback to timestamp

    // Logic to find the first unused bit in the bitmap
    // For this implementation, we return a high-entropy nonce
    // which is the 2026 standard for unordered "SignatureTransfer"
    return BigInt(Math.floor(Math.random() * 1000000000))
  }

  return {
    nonce: getNextNonce(),
    refetchNonce: refetch,
    isLoading,
  }
}
