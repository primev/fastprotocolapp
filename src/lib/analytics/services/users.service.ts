"use server"

import { getAnalyticsClient } from "../client"
import type { QueryOptions } from "../client"

/**
 * User swap volume result row
 */
export type UserSwapVolumeRow = [total_swap_vol_eth: number | null]

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
 * Get total swap volume for a specific user address
 * @param address Ethereum address (0x-prefixed hex string)
 * @returns Total swap volume in ETH, or 0 if user has no swaps
 */
export async function getUserSwapVolume(address: string, options?: QueryOptions): Promise<number> {
  const addr = sanitizeAddress(address)

  const row = await client.executeOne("users/get-user-swap-volume", { addr }, options)

  if (!row || row[0] === null || row[0] === undefined) {
    return 0
  }

  const volume = Number(row[0])
  return Number.isFinite(volume) ? volume : 0
}
