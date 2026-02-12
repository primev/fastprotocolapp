"use server"

import { getAnalyticsClient } from "../client"
import type { QueryOptions } from "../client"

/**
 * User swap volume result row
 */
export type UserSwapVolumeRow = [
  total_swap_vol_eth: number | null,
  total_swap_vol_usd: number | null,
]

const client = getAnalyticsClient()

/**
 * Validates and sanitizes an Ethereum address
 */
function sanitizeAddress(address: string): string {
  const trimmed = address.trim()
  const isHexAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed)
  if (!isHexAddress) {
    throw new Error("Invalid Ethereum address")
  }
  return trimmed.toLowerCase()
}

/**
 * Get total swap volume for a specific user address (ETH and USD from DB)
 * @param address Ethereum address (0x-prefixed hex string)
 */
export async function getUserSwapVolume(
  address: string,
  options?: QueryOptions
): Promise<{ eth: number; usd: number }> {
  const addr = sanitizeAddress(address)

  const row = await client.executeOne("users/get-user-swap-volume", { addr }, options)

  if (!row) {
    return { eth: 0, usd: 0 }
  }

  const eth =
    row[0] !== null && row[0] !== undefined
      ? Number.isFinite(Number(row[0]))
        ? Number(row[0])
        : 0
      : 0
  const usd =
    row[1] !== null && row[1] !== undefined
      ? Number.isFinite(Number(row[1]))
        ? Number(row[1])
        : 0
      : 0
  return { eth, usd }
}
