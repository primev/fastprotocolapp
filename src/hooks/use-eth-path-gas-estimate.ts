"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, usePublicClient } from "wagmi"
import { parseUnits } from "viem"
import { mainnet } from "wagmi/chains"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { FASTSWAP_API_BASE } from "@/lib/network-config"
import type { Token } from "@/types/swap"

/**
 * Fetches the actual transaction params from FastSwap for ETH-path swaps
 * and estimates gas to match what the wallet will show.
 * Use this instead of the Uniswap Quoter's gas estimate when the swap
 * goes through the ETH path (user sends tx), since the actual tx differs.
 */
export function useEthPathGasEstimate(
  enabled: boolean,
  tokenIn: Token | undefined,
  tokenOut: Token | undefined,
  amountIn: string,
  minAmountOut: string,
  deadline: number
): { gasEstimate: bigint | null; isLoading: boolean } {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient({ chainId: mainnet.id })
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isEthPath =
    enabled &&
    isConnected &&
    !!address &&
    !!tokenIn &&
    !!tokenOut &&
    tokenIn.address === ZERO_ADDRESS &&
    tokenOut.address.toLowerCase() !== WETH_ADDRESS.toLowerCase()

  const fetchAndEstimate = useCallback(async () => {
    if (!isEthPath || !address || !tokenIn || !tokenOut || !publicClient) return

    const amountClean = amountIn?.replace(/,/g, "").trim()
    const minAmountClean = minAmountOut?.replace(/,/g, "").trim()
    if (!amountClean || !minAmountClean || parseFloat(amountClean) <= 0) return

    setIsLoading(true)
    setGasEstimate(null)

    try {
      const inputAmtWei = parseUnits(amountClean, tokenIn.decimals).toString()
      const userAmtOutWei = parseUnits(minAmountClean, tokenOut.decimals).toString()
      const deadlineUnix =
        Math.floor(Date.now() / 1000) + Math.max(5, Math.min(1440, deadline)) * 60

      const body = {
        outputToken: tokenOut.address,
        inputAmt: inputAmtWei,
        userAmtOut: userAmtOutWei,
        sender: address,
        deadline: String(deadlineUnix),
      }

      const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap/eth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const ethData = await resp.json()
      if (!resp.ok || !ethData?.to || !ethData?.data) {
        setGasEstimate(null)
        return
      }

      const estimated = await publicClient.estimateGas({
        account: address as `0x${string}`,
        to: ethData.to as `0x${string}`,
        data: ethData.data as `0x${string}`,
        value: BigInt(ethData.value || 0),
      })

      setGasEstimate(estimated)
    } catch {
      setGasEstimate(null)
    } finally {
      setIsLoading(false)
    }
  }, [isEthPath, address, tokenIn, tokenOut, amountIn, minAmountOut, deadline, publicClient])

  useEffect(() => {
    if (!isEthPath) {
      setGasEstimate(null)
      setIsLoading(false)
      return
    }
    fetchAndEstimate()
  }, [fetchAndEstimate, isEthPath])

  return {
    gasEstimate: isEthPath ? gasEstimate : null,
    isLoading: isEthPath && isLoading,
  }
}
