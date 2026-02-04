"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, usePublicClient, useWalletClient } from "wagmi"
import { parseUnits } from "viem"
import { mainnet } from "wagmi/chains"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { fetchEthPathTxAndEstimate } from "@/lib/eth-path-tx"
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
  const { data: walletClient } = useWalletClient({ chainId: mainnet.id })
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
    const estimateClient = walletClient ?? publicClient
    if (!isEthPath || !address || !tokenIn || !tokenOut || !estimateClient) return

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

      const result = await fetchEthPathTxAndEstimate(
        {
          outputToken: tokenOut.address,
          inputAmt: inputAmtWei,
          userAmtOut: userAmtOutWei,
          sender: address,
          deadline: String(deadlineUnix),
        },
        estimateClient,
        address as `0x${string}`
      )

      setGasEstimate(result.gasEstimate)
    } catch {
      setGasEstimate(null)
    } finally {
      setIsLoading(false)
    }
  }, [
    isEthPath,
    address,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    deadline,
    walletClient,
    publicClient,
  ])

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
