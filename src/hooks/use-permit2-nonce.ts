"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "wagmi"
import { createPublicClient, http } from "viem"
import { mainnet } from "wagmi/chains"
import { PERMIT2_ADDRESS } from "@/lib/swap-constants"
import { FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"

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

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(FALLBACK_RPC_ENDPOINT, {
    fetchOptions: { cache: "no-store" },
  }),
})

export function usePermit2Nonce() {
  const { address } = useAccount()

  // Track locally-reserved nonces to prevent reuse within the same session
  const reservedBitsRef = useRef<Set<bigint>>(new Set())

  const [bitmap, setBitmap] = useState<bigint | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)

  const fetchBitmap = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    try {
      const result = (await publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: PERMIT2_ABI,
        functionName: "nonceBitmap",
        args: [address, WORD_POS],
        blockTag: "latest",
      } as any)) as bigint
      setBitmap(result)
    } catch (err) {
      console.error("Permit2 nonceBitmap fetch failed:", err)
      setBitmap(undefined)
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (address) {
      fetchBitmap()
    } else {
      setBitmap(undefined)
      setIsLoading(false)
    }
  }, [address, fetchBitmap])

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
    await fetchBitmap()
  }, [fetchBitmap])

  /** True when the bitmap has been loaded and getFreshNonce can be called safely. */
  const isReady = !isLoading && !!address && bitmap !== undefined

  return {
    isLoading,
    isReady,
    getFreshNonce,
    releaseNonce,
    syncFromChain,
    refetchNonce: fetchBitmap,
  }
}
