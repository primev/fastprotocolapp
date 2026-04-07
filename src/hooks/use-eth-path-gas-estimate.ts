"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, usePublicClient } from "wagmi"
import { parseUnits } from "viem"
import { mainnet } from "wagmi/chains"
import { ZERO_ADDRESS, WETH_ADDRESS } from "@/lib/swap-constants"
import { fetchEthPathTxAndEstimate, type EthPathTxResult } from "@/lib/eth-path-tx"
import type { Token } from "@/types/swap"

/**
 * Fetches the actual transaction params from FastSwap for ETH-path swaps
 * and estimates gas to match what the wallet will show.
 *
 * Returns the FULL tx result (not just gas) so it can be reused at submission
 * time — this lets the wallet popup open synchronously off the user gesture,
 * preventing focus loss on macOS.
 */
export function useEthPathGasEstimate(
  enabled: boolean,
  tokenIn: Token | undefined,
  tokenOut: Token | undefined,
  amountIn: string,
  minAmountOut: string,
  deadline: number
): {
  gasEstimate: bigint | null
  isLoading: boolean
  preparedTx: EthPathTxResult | null
} {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient({ chainId: mainnet.id })
  const [preparedTx, setPreparedTx] = useState<EthPathTxResult | null>(null)
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
    setPreparedTx(null)

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
        publicClient,
        address as `0x${string}`
      )

      setPreparedTx(result)
    } catch {
      setPreparedTx(null)
    } finally {
      setIsLoading(false)
    }
  }, [isEthPath, address, tokenIn, tokenOut, amountIn, minAmountOut, deadline, publicClient])

  useEffect(() => {
    if (!isEthPath) {
      setPreparedTx(null)
      setIsLoading(false)
      return
    }
    fetchAndEstimate()
  }, [fetchAndEstimate, isEthPath])

  return {
    gasEstimate: isEthPath ? (preparedTx?.gasEstimate ?? null) : null,
    isLoading: isEthPath && isLoading,
    preparedTx: isEthPath ? preparedTx : null,
  }
}
