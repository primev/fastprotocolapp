"use client"

import { useCallback, useRef } from "react"
import { useReadContract, useAccount } from "wagmi"
import { PERMIT2_ADDRESS } from "@/lib/swap-constants"

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

/**
 * wordPos 0 is used as the default starting point.
 * nonce = (wordPos << 8) | bitPos
 */
const WORD_POS = 0n

export function usePermit2Nonce() {
  const { address } = useAccount()

  // Track locally-reserved nonces to prevent reuse within the same session
  const reservedBitsRef = useRef<Set<bigint>>(new Set())

  const {
    data: bitmap,
    refetch,
    isLoading,
  } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: "nonceBitmap",
    args: address ? [address, WORD_POS] : undefined,
    query: {
      enabled: !!address,
    },
  })

  /**
   * Scans the 256-bit word for the first bit that is both 0 on-chain
   * and not currently reserved in the local session.
   */
  const findFreeBit = useCallback((): bigint => {
    if (bitmap === undefined) throw new Error("Permit2 bitmap not loaded")

    for (let i = 0n; i < 256n; i++) {
      const mask = 1n << i
      const isUsedOnChain = (bitmap & mask) !== 0n
      const isUsedLocally = reservedBitsRef.current.has(i)

      if (!isUsedOnChain && !isUsedLocally) return i
    }

    throw new Error("No available Permit2 nonces in current word")
  }, [bitmap])

  /**
   * Generates a fresh nonce and optimistically reserves the bit.
   */
  const getFreshNonce = useCallback((): bigint => {
    const bitPos = findFreeBit()
    reservedBitsRef.current.add(bitPos)

    // Construct the full nonce: (word << 8) + bit
    return (WORD_POS << 8n) | bitPos
  }, [findFreeBit])

  /**
   * Releases a local reservation. Useful if a user rejects a signature
   * or a request fails before hitting the mempool.
   */
  const releaseNonce = useCallback((nonce: bigint) => {
    const bitPos = nonce & 0xffn // Extract the last 8 bits
    reservedBitsRef.current.delete(bitPos)
  }, [])

  /**
   * Clears local reservations and synchronizes state with the blockchain.
   */
  const syncFromChain = useCallback(async () => {
    reservedBitsRef.current.clear()
    await refetch()
  }, [refetch])

  return {
    isLoading,
    getFreshNonce,
    releaseNonce,
    syncFromChain,
    refetchNonce: refetch,
  }
}
