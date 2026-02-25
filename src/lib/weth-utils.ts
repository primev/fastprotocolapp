/**
 * WETH wrap/unwrap utility functions
 * Helper functions for detecting wrap/unwrap operations and estimating gas
 */

import { createPublicClient, http, type Address } from "viem"
import { mainnet } from "wagmi/chains"
import { parseUnits } from "viem"
import { WETH_ADDRESS, ZERO_ADDRESS } from "@/lib/swap-constants"
import { FALLBACK_RPC_ENDPOINT } from "@/lib/network-config"
import { WETH_ABI } from "./weth-abi"
import type { Token } from "@/types/swap"

/**
 * Check if the operation is ETH → WETH (wrap)
 */
export function isWrapOperation(fromToken: Token | undefined, toToken: Token | undefined): boolean {
  if (!fromToken || !toToken) return false

  const fromIsETH = fromToken.address === ZERO_ADDRESS || fromToken.symbol.toUpperCase() === "ETH"
  const toIsWETH =
    toToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase() ||
    toToken.symbol.toUpperCase() === "WETH"

  return fromIsETH && toIsWETH
}

/**
 * Check if the operation is WETH → ETH (unwrap)
 */
export function isUnwrapOperation(
  fromToken: Token | undefined,
  toToken: Token | undefined
): boolean {
  if (!fromToken || !toToken) return false

  const fromIsWETH =
    fromToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase() ||
    fromToken.symbol.toUpperCase() === "WETH"
  const toIsETH = toToken.address === ZERO_ADDRESS || toToken.symbol.toUpperCase() === "ETH"

  return fromIsWETH && toIsETH
}

/**
 * Check if the pair is a wrap/unwrap operation (either direction)
 */
export function isWrapUnwrapPair(
  fromToken: Token | undefined,
  toToken: Token | undefined
): boolean {
  return isWrapOperation(fromToken, toToken) || isUnwrapOperation(fromToken, toToken)
}

/**
 * Estimate gas for wrapping ETH to WETH
 * @param amount Amount in ETH (as string, e.g., "1.5")
 * @param account User's account address
 * @returns Gas estimate in wei, or null if estimation fails
 */
export async function estimateWrapGas(amount: string, account: Address): Promise<bigint | null> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(FALLBACK_RPC_ENDPOINT, {
        fetchOptions: { cache: "no-store" },
      }),
    })

    const amountInWei = parseUnits(amount, 18)

    // Check ETH balance first to avoid revert errors during gas estimation
    let balance: bigint
    try {
      balance = await client.getBalance({ address: account })
    } catch (balanceError) {
      console.warn("Failed to fetch ETH balance for gas estimation:", balanceError)
      return null // Return null if we can't check balance
    }

    // If user doesn't have enough ETH balance, return null (don't estimate)
    if (balance < amountInWei) {
      return null
    }

    let gasEstimate: bigint
    try {
      gasEstimate = await client.estimateContractGas({
        account,
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "deposit",
        value: amountInWei,
      })
    } catch (gasError) {
      console.warn("Failed to estimate wrap gas:", gasError)
      return null // Return null instead of throwing
    }

    return gasEstimate
  } catch (error) {
    console.error("Error estimating wrap gas:", error)
    // Return null on error (insufficient balance or other issues)
    // The UI will handle missing gas estimate gracefully
    return null
  }
}

/**
 * Estimate gas for unwrapping WETH to ETH
 * @param amount Amount in WETH (as string, e.g., "1.5")
 * @param account User's account address
 * @returns Gas estimate in wei, or null if estimation fails
 */
export async function estimateUnwrapGas(amount: string, account: Address): Promise<bigint | null> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(FALLBACK_RPC_ENDPOINT, {
        fetchOptions: { cache: "no-store" },
      }),
    })

    const amountInWei = parseUnits(amount, 18)

    // Check balance first to avoid revert errors during gas estimation
    let balance: bigint
    try {
      balance = (await client.readContract({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "balanceOf",
        args: [account],
      } as any)) as bigint
    } catch (balanceError) {
      console.warn("Failed to fetch WETH balance for gas estimation:", balanceError)
      return null // Return null if we can't check balance
    }

    // If user doesn't have enough balance, return null (don't estimate)
    if (balance < amountInWei) {
      return null
    }

    let gasEstimate: bigint
    try {
      gasEstimate = await client.estimateContractGas({
        account,
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: "withdraw",
        args: [amountInWei],
      })
    } catch (gasError) {
      console.warn("Failed to estimate unwrap gas:", gasError)
      return null // Return null instead of throwing
    }

    return gasEstimate
  } catch (error) {
    console.error("Error estimating unwrap gas:", error)
    // Return null on error (insufficient balance or other issues)
    // The UI will handle missing gas estimate gracefully
    return null
  }
}
