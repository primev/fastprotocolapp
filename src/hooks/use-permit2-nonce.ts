"use client"

import { useCallback, useRef } from "react"
import { useReadContract, useAccount } from "wagmi"
import { PERMIT2_ADDRESS } from "@/lib/swap-constants"

/**
 * Minimal Permit2 ABI for bitmap nonce management
 */
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
 * Permit2 uses:
 *
 * nonce = (wordPos << 8) | bitPos
 *
 * Each word has 256 bits.
 */
const WORD_POS = 0n

export function usePermit2Nonce() {
  const { address } = useAccount()

  // Track locally-reserved nonces to avoid double-sign in same session
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
   * Find first unused bit in bitmap + local reservations
   */
  const findFreeBit = useCallback((): bigint => {
    if (bitmap === undefined) {
      throw new Error("Permit2 bitmap not loaded")
    }

    for (let i = 0n; i < 256n; i++) {
      const mask = 1n << i

      const usedOnChain = (bitmap & mask) !== 0n
      const usedLocally = reservedBitsRef.current.has(i)

      if (!usedOnChain && !usedLocally) {
        return i
      }
    }

    throw new Error("No available Permit2 nonces in word 0")
  }, [bitmap])

  /**
   * Call ONLY when user is about to sign.
   */
  const getFreshNonce = useCallback((): bigint => {
    const bitPos = findFreeBit()

    // Optimistically reserve locally (prevents double sign in same session)
    reservedBitsRef.current.add(bitPos)

    // nonce = (wordPos << 8) | bitPos
    const nonce = (WORD_POS << 8n) | bitPos

    console.log("[Permit2 nonce]", {
      bitmap: bitmap.toString(),
      bitmapHex: bitmap.toString(16),
      reservedBitsCount: reservedBitsRef.current.size,
      reservedBits: [...reservedBitsRef.current].map((b) => b.toString()),
      wordPos: WORD_POS.toString(),
      bitPos: bitPos.toString(),
      nonce: nonce.toString(),
      nonceHex: nonce.toString(16),
    })

    return nonce
  }, [findFreeBit, bitmap])

  /**
   * If signing fails before submission, release reservation.
   */
  const releaseNonce = useCallback((nonce: bigint) => {
    const bitPos = nonce & 0xffn
    reservedBitsRef.current.delete(bitPos)
    console.log("[Permit2 nonce] releaseNonce", {
      nonce: nonce.toString(),
      bitPos: bitPos.toString(),
      reservedCountAfter: reservedBitsRef.current.size,
    })
  }, [])

  /**
   * After tx confirmed, refresh bitmap from chain.
   */
  const syncFromChain = useCallback(async () => {
    console.log("[Permit2 nonce] syncFromChain – clearing reserved, refetching bitmap")
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
