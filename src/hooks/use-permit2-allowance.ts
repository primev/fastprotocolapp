"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseUnits, maxUint256 } from "viem"
import { mainnet } from "wagmi/chains"
import { PERMIT2_ADDRESS, ZERO_ADDRESS } from "@/lib/swap-constants"
import { ERC20_APPROVE_ABI } from "@/lib/erc20-abi"
import { reportClientError } from "@/lib/report-client-error"
import type { Token } from "@/types/swap"

interface UsePermit2AllowanceParams {
  token: Token | undefined
  owner: `0x${string}` | undefined
  amount: string
  enabled?: boolean
}

/**
 * Hook to check if the user has approved Permit2 to spend the token,
 * and to execute the approval transaction when needed.
 * Only relevant for Permit path (ERC20 input). Skip for ETH, wrap/unwrap.
 */
export function usePermit2Allowance({
  token,
  owner,
  amount,
  enabled = true,
}: UsePermit2AllowanceParams) {
  const amountInWei = useMemo(() => {
    if (!amount || !token) return 0n
    const cleaned = amount.replace(/,/g, "").trim()
    try {
      return parseUnits(cleaned, token.decimals)
    } catch {
      return 0n
    }
  }, [amount, token])

  const { data: allowance, isLoading: isLoadingAllowance } = useReadContract({
    address: token?.address as `0x${string}` | undefined,
    abi: ERC20_APPROVE_ABI,
    functionName: "allowance",
    args: owner ? [owner, PERMIT2_ADDRESS] : undefined,
    query: {
      enabled:
        enabled &&
        !!token &&
        !!owner &&
        token.address?.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
        amountInWei > 0n,
    },
  })

  const {
    writeContract,
    data: hash,
    isPending: isApproving,
    isError: isApprovalError,
    error: approvalError,
    reset: resetWrite,
  } = useWriteContract()

  useEffect(() => {
    if (!approvalError) return
    reportClientError(approvalError, {
      source: "use-permit2-allowance.writeError",
      walletAddress: owner,
      tokenAddress: token?.address,
      tokenSymbol: token?.symbol,
    })
  }, [approvalError, owner, token?.address, token?.symbol])

  const { data: receipt } = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
  })

  const [justApproved, setJustApproved] = useState(false)

  // Receipt is confirmation — no need to refetch allowance
  useEffect(() => {
    if (receipt && hash) {
      setJustApproved(true)
      resetWrite()
    }
  }, [receipt, hash, resetWrite])

  // Reset only when token changes (new token needs its own approval). Amount changes don't matter — we approve maxUint256.
  useEffect(() => {
    setJustApproved(false)
  }, [token?.address])

  const approve = useCallback(() => {
    if (!token || !owner) return
    writeContract({
      address: token.address as `0x${string}`,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [PERMIT2_ADDRESS, maxUint256],
      chain: mainnet,
      account: owner,
    })
  }, [token, owner, writeContract])

  const needsApproval =
    !justApproved &&
    enabled &&
    !!token &&
    !!owner &&
    allowance !== undefined &&
    allowance < amountInWei

  return {
    needsApproval: !!needsApproval,
    isLoading: isLoadingAllowance,
    approve,
    isApproving,
    isApprovalRejected: !!isApprovalError,
    /** Set when user has signed; use to distinguish "Confirm in wallet" vs "Approving..." */
    approvalTxHash: hash ?? undefined,
  }
}
