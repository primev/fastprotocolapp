import { createPublicClient, http, type Address } from "viem"
import { mainnet } from "wagmi/chains"
import { RPC_ENDPOINT, FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract-config"

/**
 * Server-side function to fetch totalSupply from the contract
 * This can be used in Server Components and API routes
 */
export async function getTotalSupply(): Promise<bigint | null> {
  try {
    // Try Fast RPC first
    try {
      const fastRpcClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_ENDPOINT, {
          fetchOptions: {
            cache: "no-store",
          },
        }),
      })

      const result = await fastRpcClient.readContract({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: "totalSupply",
        blockTag: "latest",
      } as any)

      // If result is valid, return it
      if (result !== null && result !== undefined) {
        return result as bigint
      }
    } catch (fastRpcError) {
      console.warn("Fast RPC call failed, trying fallback:", fastRpcError)
    }

    // Fallback to public RPC
    const publicRpcClient = createPublicClient({
      chain: mainnet,
      transport: http(FALLBACK_RPC_ENDPOINT, {
        fetchOptions: {
          cache: "no-store",
        },
      }),
    })

    const result = await publicRpcClient.readContract({
      address: CONTRACT_ADDRESS as Address,
      abi: CONTRACT_ABI,
      functionName: "totalSupply",
      blockTag: "latest",
    } as any)

    return (result as bigint) || null
  } catch (error) {
    console.error("Error fetching totalSupply:", error)
    return null
  }
}
