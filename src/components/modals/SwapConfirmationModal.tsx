"use client"

import React, { useEffect, useMemo, useCallback, useState, useRef } from "react"
import NumberFlow from "@number-flow/react"
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { isStablecoin } from "@/lib/stablecoins"
import { useBroadcastGasPrice } from "@/hooks/use-broadcast-gas-price"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  X,
  Loader2,
  RefreshCw,
  ChevronDown,
  Info,
  Fuel,
  AlertTriangle,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react"
import type { Token } from "@/types/swap"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { useSwapConfirmation } from "@/hooks/use-swap-confirmation"
import { getPriceImpactSeverity } from "@/hooks/use-swap-quote"
import {
  getTransactionErrorTitle,
  getTransactionFullMessage,
  getTransactionShortMessage,
  parseBarterSlippageError,
  RPCError,
} from "@/lib/transaction-errors"
import { useAccount } from "wagmi"
import { mainnet } from "wagmi/chains"
import { useTokenPrice } from "@/hooks/use-token-price"
import { DEFAULT_ETH_PRICE_USD } from "@/lib/constants"
import { GAS_LIMIT_MULTIPLIER, ETH_PATH_DISPLAY_MULTIPLIER } from "@/hooks/use-broadcast-gas-price"
import { useEthPathGasEstimate } from "@/hooks/use-eth-path-gas-estimate"
import { ZERO_ADDRESS } from "@/lib/swap-constants"
import { useSwapToastStore } from "@/stores/swapToastStore"

const numberFlowStyle = {
  "--number-flow-char-gap": "-0.5px",
  "--number-flow-mask-duration": "0.3s",
  "--number-flow-mask-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
  fontVariantNumeric: "tabular-nums",
} as React.CSSProperties

interface SwapConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenIn: Token | undefined
  tokenOut: Token | undefined
  amountIn: string
  /** Expected receive amount (price without slippage). Shown in the main Receive card. */
  amountOut: string
  /** Minimum output / max input we accept (contract value). Passed to useSwapConfirmation. */
  minAmountOut: string
  /** Formatted slippage-limited value for the "Minimum received" / "Maximum sold" detail row. */
  slippageLimitFormatted: string
  /** true = exactOut: show "Maximum sold" (tokenIn). false = exactIn: show "Minimum received" (tokenOut). */
  isMaxIn?: boolean
  exchangeRate: number
  priceImpact: number
  slippage: string
  /** Transaction deadline in minutes (5–1440). Passed to useSwapConfirmation. */
  deadline: number
  gasEstimate: bigint | null
  ethPrice?: number | null
  /** USD price per token for the "from" token (used for USD under amount). */
  fromTokenPrice?: number | null
  /** USD price per token for the "to" token (used for USD under amount). */
  toTokenPrice?: number | null
  timeLeft?: number
  isLoading?: boolean
  refreshBalances?: () => Promise<void>
  /** Called when DB has success receipt (pre-confirmation). Use to reset parent form state. */
  onCloseAfterSuccess?: () => void
  setClearSwapState: (clear: boolean) => void
  /** Permit2 approval state (Permit path only) */
  needsPermit2Approval?: boolean
  isApproving?: boolean
  /** True when user rejected/cancelled the approval in wallet */
  isApprovalRejected?: boolean
  /** Set when approval tx is submitted; distinguishes "Confirm in wallet" vs "Approving..." */
  approvalTxHash?: string
  onApprove?: () => void
  approveTokenSymbol?: string
  /** Called with the recommended slippage when a barter slippage error is detected. */
  onRetryWithSlippage?: (slippage: string) => void
  /** Error from a failed tx after submit (e.g. status 0x0). Shows error modal. */
  externalError?: {
    message: string
    receipt?: unknown
    /** Raw DB/RPC result as returned (for Error Log when user clicks). */
    rawDbRecord?: unknown
    /** True when error occurred after pre-confirmation (e.g. reverted after DB 0x1). Try Again is hidden. */
    occurredAfterPreConfirm?: boolean
  } | null
}

interface InfoRowProps {
  label: string
  value: React.ReactNode
  tooltip?: string
  valueClassName?: string
}

function InfoRow({ label, value, tooltip, valueClassName }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-gray-400">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] bg-[#1c2128] border-white/10">
                <p className="text-xs text-gray-300">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span
        className={cn(
          "text-sm font-medium text-white",
          valueClassName,
          (label === "Minimum received" || label === "Maximum sold") && "text-emerald-400"
        )}
      >
        {value}
      </span>
    </div>
  )
}

import { TokenIcon } from "@/components/swap/TokenIcon"

function BuyReceiveValue({ value, className }: { value: string; className?: string }) {
  const clean = value?.replace(/,/g, "") ?? ""
  const numeric = clean && !Number.isNaN(parseFloat(clean)) ? parseFloat(clean) : null
  const decimalPlaces = clean.includes(".") ? (clean.split(".")[1]?.length ?? 0) : 0
  const minFractionDigits = Math.min(decimalPlaces, 6)
  const maxFractionDigits = Math.max(6, decimalPlaces)

  if (numeric === null) {
    return <span className={className}>{value || "0"}</span>
  }

  return (
    <span className={className}>
      <NumberFlow
        value={numeric}
        format={{
          minimumFractionDigits: minFractionDigits,
          maximumFractionDigits: maxFractionDigits,
          useGrouping: true,
        }}
        style={numberFlowStyle}
      />
    </span>
  )
}

function SwapConfirmationModal({
  open,
  onOpenChange,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  minAmountOut,
  slippageLimitFormatted,
  isMaxIn = false,
  exchangeRate,
  priceImpact,
  slippage,
  deadline,
  gasEstimate,
  ethPrice,
  fromTokenPrice,
  toTokenPrice,
  timeLeft,
  isLoading = false,
  refreshBalances,
  onCloseAfterSuccess,
  setClearSwapState,
  needsPermit2Approval = false,
  isApproving = false,
  isApprovalRejected = false,
  approvalTxHash,
  onApprove,
  approveTokenSymbol,
  onRetryWithSlippage,
  externalError,
}: SwapConfirmationModalProps) {
  // --- EXTERNAL HOOKS ---
  const { chain: signerChain, isConnected } = useAccount()

  // If signerChain is undefined, the wallet isn't connected to a signer yet.
  const isEthereumMainnet = useMemo(() => {
    return isConnected && signerChain?.id === mainnet.id
  }, [isConnected, signerChain])

  const {
    isWrap,
    isUnwrap,
    wrap,
    unwrap,
    error: wrapError,
    reset: resetWrap,
    gasEstimate: wethGasEstimate,
  } = useWethWrapUnwrap({
    fromToken: tokenIn,
    toToken: tokenOut,
    amount: amountIn,
  })

  const addToast = useSwapToastStore((s) => s.addToast)
  const updateToastHash = useSwapToastStore((s) => s.updateToastHash)
  const removeToast = useSwapToastStore((s) => s.removeToast)

  const {
    confirmSwap,
    isSigning,
    isSubmitting,
    error: swapError,
    reset: resetSwap,
    isNonceLoading,
  } = useSwapConfirmation({
    fromToken: tokenIn,
    toToken: tokenOut,
    amount: amountIn,
    minAmountOut,
    slippage,
    deadline,
    onSuccess: () => {
      setClearSwapState(true)
      if (refreshBalances) {
        setTimeout(() => refreshBalances(), 1000)
      }
    },
  })

  const { bufferedPrice: gasPrice } = useBroadcastGasPrice()
  const { price: ethPriceFromApi } = useTokenPrice("ETH")
  const effectiveEthPrice = ethPrice ?? ethPriceFromApi ?? DEFAULT_ETH_PRICE_USD

  // For ETH-path swaps, estimate gas on the actual FastSwap tx to match wallet display.
  const { gasEstimate: ethPathGasEstimate } = useEthPathGasEstimate(
    open && !isWrap && !isUnwrap,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    deadline
  )

  const [isExpanded, setIsExpanded] = useState(false)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isApprovalInProgress, setIsApprovalInProgress] = useState(false)
  const [isAutoSwappingAfterApproval, setIsAutoSwappingAfterApproval] = useState(false)
  const prevNeedsApprovalRef = useRef(needsPermit2Approval)

  // Reset accordion when modal closes so it starts collapsed on next open
  useEffect(() => {
    if (!open) setIsExpanded(false)
  }, [open])

  // When user cancels approval in wallet, reset so they can try again
  useEffect(() => {
    if (isApprovalRejected) setIsApprovalInProgress(false)
  }, [isApprovalRejected])

  const operationType = isWrap ? "wrap" : isUnwrap ? "unwrap" : "swap"
  const impactSeverity = useMemo(
    () => (isWrap || isUnwrap ? "low" : getPriceImpactSeverity(priceImpact)),
    [isWrap, isUnwrap, priceImpact]
  )

  const intentPath =
    !isWrap && !isUnwrap && tokenIn && tokenIn.address?.toLowerCase() !== ZERO_ADDRESS.toLowerCase()

  // --- ACTIONS ---
  const resetAllStates = useCallback(() => {
    if (resetWrap) resetWrap()
    if (resetSwap) resetSwap()
    setIsErrorModalOpen(false)
    setIsApprovalInProgress(false)
    setIsAutoSwappingAfterApproval(false)
  }, [resetWrap, resetSwap])

  const activeGasEstimate = useMemo(() => {
    if (isWrap || isUnwrap) return wethGasEstimate
    const base = ethPathGasEstimate ?? gasEstimate
    if (!base) return null
    // ETH path: use display multiplier so estimate aligns with wallet (wallet adds buffers)
    if (ethPathGasEstimate) {
      return (base * ETH_PATH_DISPLAY_MULTIPLIER) / 100n
    }
    return (base * GAS_LIMIT_MULTIPLIER) / 100n
  }, [isWrap, isUnwrap, wethGasEstimate, ethPathGasEstimate, gasEstimate])

  const clearLastTxError = useSwapToastStore((s) => s.clearLastTxError)

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetAllStates()
      clearLastTxError()
    }
    onOpenChange(isOpen)
  }

  const executeSwap = useCallback(async () => {
    setIsConfirming(true)
    let pendingPlaceholder: string | null = null
    try {
      const onConfirm = () => {
        setClearSwapState(true)
        if (refreshBalances) setTimeout(() => refreshBalances(), 1000)
      }
      if (isWrap) {
        const hash = await wrap()
        addToast(hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onCloseAfterSuccess)
        onOpenChange(false)
      } else if (isUnwrap) {
        const hash = await unwrap()
        addToast(hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onCloseAfterSuccess)
        onOpenChange(false)
      } else {
        const hash = await confirmSwap(
          intentPath
            ? {
                onPendingHash: (ph) => {
                  pendingPlaceholder = ph
                  addToast(
                    ph,
                    tokenIn,
                    tokenOut,
                    amountIn,
                    amountOut,
                    onConfirm,
                    onCloseAfterSuccess
                  )
                },
              }
            : undefined
        )
        if (pendingPlaceholder) {
          updateToastHash(pendingPlaceholder, hash)
        } else {
          addToast(hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onCloseAfterSuccess)
        }
        onOpenChange(false)
      }
    } catch {
      // Error is set by hooks (wrapError/swapError); ERROR VIEW shows with "View Error Details" / "Try Again"
      // Remove zombie toast with pending placeholder hash (relayer failed before returning real hash)
      if (pendingPlaceholder) removeToast(pendingPlaceholder)
    } finally {
      setIsConfirming(false)
      setIsAutoSwappingAfterApproval(false)
    }
  }, [
    isWrap,
    isUnwrap,
    wrap,
    unwrap,
    confirmSwap,
    intentPath,
    addToast,
    updateToastHash,
    removeToast,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    setClearSwapState,
    refreshBalances,
    onCloseAfterSuccess,
    onOpenChange,
  ])

  const handleConfirm = useCallback(async () => {
    // Approve: modal-only, NO toast (Uniswap pattern — avoids stacked approve + swap toasts)
    if (intentPath && needsPermit2Approval && onApprove) {
      setIsApprovalInProgress(true)
      await onApprove()
      return
    }
    executeSwap()
  }, [intentPath, needsPermit2Approval, onApprove, executeSwap])

  // When approval completes, auto-trigger swap (intent signature) so user doesn't have to click again
  useEffect(() => {
    const prev = prevNeedsApprovalRef.current
    prevNeedsApprovalRef.current = needsPermit2Approval

    if (prev && !needsPermit2Approval && intentPath && isApprovalInProgress) {
      setIsAutoSwappingAfterApproval(true)
      executeSwap()
    }
    if (!needsPermit2Approval) setIsApprovalInProgress(false)
  }, [needsPermit2Approval, intentPath, isApprovalInProgress, executeSwap])

  const gasCostUsd = useMemo(() => {
    if (!activeGasEstimate || !gasPrice) return null
    try {
      const totalWei = BigInt(activeGasEstimate) * BigInt(gasPrice)
      const totalEth = Number(totalWei) / 1e18
      return totalEth * effectiveEthPrice
    } catch {
      return null
    }
  }, [activeGasEstimate, gasPrice, effectiveEthPrice])

  // USD value under each token amount (match main swap form, NumberFlow + commas)
  const fromUsdValue = useMemo(() => {
    const num = parseFloat(amountIn?.replace(/,/g, "") ?? "")
    if (isNaN(num) || num <= 0 || fromTokenPrice == null || fromTokenPrice <= 0) return null
    return num * fromTokenPrice
  }, [amountIn, fromTokenPrice])
  const toUsdValue = useMemo(() => {
    const num = parseFloat(amountOut?.replace(/,/g, "") ?? "")
    if (isNaN(num) || num <= 0 || toTokenPrice == null || toTokenPrice <= 0) return null
    return num * toTokenPrice
  }, [amountOut, toTokenPrice])

  const activeError = externalError
    ? new RPCError(
        externalError.message,
        externalError.receipt as import("viem").TransactionReceipt | undefined
      )
    : wrapError || swapError

  const errorTitle = useMemo(
    () => getTransactionErrorTitle(activeError, operationType),
    [activeError, operationType]
  )

  const barterSlippageInfo = useMemo(() => {
    if (!activeError) return null
    return parseBarterSlippageError(activeError.message)
  }, [activeError])

  /** Content for Error Log modal: raw DB record when available, else receipt JSON, else full message. */
  const errorDetailContent = useMemo(() => {
    if (!activeError) return ""
    if (externalError?.rawDbRecord != null) {
      return JSON.stringify(
        externalError.rawDbRecord,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )
    }
    if (externalError?.receipt != null) {
      return JSON.stringify(
        externalError.receipt,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )
    }
    return getTransactionFullMessage(activeError)
  }, [activeError, externalError?.rawDbRecord, externalError?.receipt])

  const copyErrorToClipboard = useCallback(() => {
    if (!errorDetailContent) return
    navigator.clipboard.writeText(errorDetailContent)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }, [errorDetailContent])

  // Rate is "tokenOut per 1 tokenIn"; format by whether tokenOut is stable (match swap form)
  const rateToStable = useMemo(
    () => isStablecoin(tokenOut?.address ?? "", tokenOut?.symbol),
    [tokenOut?.address, tokenOut?.symbol]
  )

  /**
   * CTA button state for all swap flows.
   * Handles: approval → auto-swap, intent signing, wrap/unwrap, ETH path, connect prompt, high impact.
   */
  const ctaState = useMemo(() => {
    const isApprovalFlow = intentPath && needsPermit2Approval
    const isApprovalActive = isApprovalFlow && (isApproving || isApprovalInProgress)
    const isSwapFlow = intentPath && !needsPermit2Approval
    const isSwapActive =
      isSwapFlow && (isSigning || isSubmitting || isConfirming || isAutoSwappingAfterApproval)

    // Disabled when: loading, wrong network, or wallet action in progress
    const disabled =
      isLoading ||
      isConfirming ||
      !isEthereumMainnet ||
      (intentPath && isNonceLoading) ||
      isApprovalActive ||
      isSwapActive

    // Label and spinner for each state (priority order)
    // Approval: "Confirm in wallet" (wallet open, no hash yet) → "Approving..." (tx submitted, hash set)
    if (isLoading) return { label: "Fetching...", disabled, showSpinner: true }
    if (intentPath && isNonceLoading)
      return { label: "Initializing...", disabled, showSpinner: true }
    if (isApprovalActive && approvalTxHash)
      return { label: "Approving...", disabled, showSpinner: true }
    if (isApprovalActive) return { label: "Confirm in wallet", disabled, showSpinner: true }
    if (isSigning || isAutoSwappingAfterApproval)
      return { label: "Confirm in wallet", disabled, showSpinner: true }
    if (isSubmitting) return { label: "Submitting...", disabled, showSpinner: true }
    if (isConfirming) return { label: "Confirming...", disabled, showSpinner: true }
    if (isApprovalFlow) return { label: "Approve & Swap", disabled, showSpinner: false }
    if (!isEthereumMainnet) return { label: "Connect to Ethereum", disabled, showSpinner: false }
    if (!isWrap && !isUnwrap && impactSeverity === "high")
      return { label: "Swap Anyway", disabled, showSpinner: false }
    return { label: `Confirm ${operationType}`, disabled, showSpinner: false }
  }, [
    intentPath,
    needsPermit2Approval,
    isApproving,
    isApprovalInProgress,
    approvalTxHash,
    isSigning,
    isSubmitting,
    isConfirming,
    isAutoSwappingAfterApproval,
    isLoading,
    isNonceLoading,
    isEthereumMainnet,
    isWrap,
    isUnwrap,
    impactSeverity,
    operationType,
  ])

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogOverlay className="bg-black/60 backdrop-blur-md transition-all duration-300" />
        <DialogContent
          hideClose
          className="sm:max-w-[500px] max-h-[90dvh] p-0 gap-0 bg-[#0d1117] border-white/10 overflow-hidden overflow-y-auto rounded-[28px] outline-none ring-0 shadow-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* HEADER */}
          <DialogHeader className="py-5 sm:py-6 px-5 relative">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg sm:text-xl font-bold text-white">
                {activeError ? errorTitle : "You're swapping"}
              </DialogTitle>
              <DialogClose asChild>
                <button
                  onClick={() => handleOpenChange(false)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-white" />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>

          {activeError ? (
            /* ERROR VIEW */
            <div className="flex flex-col items-center pb-10 px-8 text-center animate-in fade-in duration-300">
              {barterSlippageInfo ? (
                <>
                  <p className="text-[14px] font-medium text-white/75 max-w-[320px] leading-relaxed mb-2">
                    Slippage too low for this swap.
                  </p>
                  <p className="text-[13px] text-zinc-400 max-w-[300px] leading-relaxed mb-6">
                    Minimum required slippage:{" "}
                    <span className="text-white font-semibold">
                      {barterSlippageInfo.recommendedSlippage}%
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      resetAllStates()
                      clearLastTxError()
                      onRetryWithSlippage?.(barterSlippageInfo.recommendedSlippage)
                    }}
                    className="w-full h-14 bg-[#3898FF] hover:bg-[#3898FF]/90 text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl transition-all flex items-center justify-center gap-3 mb-3"
                  >
                    <RefreshCw size={16} /> Retry with {barterSlippageInfo.recommendedSlippage}%
                    slippage
                  </button>
                  <button
                    onClick={() => setIsErrorModalOpen(true)}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    View Error Details
                    <ChevronRight
                      size={14}
                      className="group-hover:translate-x-0.5 transition-transform"
                    />
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-medium text-white/75 max-w-[320px] leading-relaxed mb-6">
                    {getTransactionShortMessage(activeError)}
                  </p>
                  <button
                    onClick={() => setIsErrorModalOpen(true)}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-all mb-6"
                  >
                    View Error Details
                    <ChevronRight
                      size={14}
                      className="group-hover:translate-x-0.5 transition-transform"
                    />
                  </button>
                  {!externalError?.occurredAfterPreConfirm && (
                    <button
                      type="button"
                      onClick={() => {
                        resetAllStates()
                        clearLastTxError()
                        executeSwap()
                      }}
                      className="w-full h-14 bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl transition-all flex items-center justify-center gap-3"
                    >
                      <RefreshCw size={16} /> Try Again
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            /* REVIEW VIEW */
            <div className="animate-in fade-in duration-300">
              {/* Transaction Summary */}
              <div className=" px-5 pb-6 space-y-3">
                {/* From Token */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-2xl sm:text-3xl font-bold text-white">
                      <BuyReceiveValue value={amountIn} className="tabular-nums" />{" "}
                      {tokenIn?.symbol}
                    </p>
                    <p className="text-sm text-gray-500 tabular-nums">
                      {fromUsdValue != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          ≈ $
                          <NumberFlow
                            value={fromUsdValue}
                            format={{
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                              useGrouping: true,
                            }}
                            style={numberFlowStyle}
                          />
                        </span>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <TokenIcon token={tokenIn} className="h-11 w-11 sm:h-12 sm:w-12" />
                </div>

                {/* Arrow Indicator */}
                <div className="flex justify-center py-0.5">
                  <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </div>
                </div>

                {/* To Token */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-2xl sm:text-3xl font-bold text-white">
                      <BuyReceiveValue value={amountOut} className="tabular-nums" />{" "}
                      {tokenOut?.symbol}
                    </p>
                    <p className="text-sm text-gray-500 tabular-nums">
                      {toUsdValue != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          ≈ $
                          <NumberFlow
                            value={toUsdValue}
                            format={{
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                              useGrouping: true,
                            }}
                            style={numberFlowStyle}
                          />
                        </span>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <TokenIcon token={tokenOut} className="h-11 w-11 sm:h-12 sm:w-12" />
                </div>
              </div>

              {/* Details Section */}
              <div className="px-5 sm:px-6 pb-3 bg-white/[0.02] border-y border-white/5">
                <div className="divide-y divide-white/5">
                  {impactSeverity === "high" ? (
                    <InfoRow
                      label="Price impact"
                      value={
                        <span className="flex items-center gap-1.5 tabular-nums">
                          {priceImpact < 0 && "-"}
                          <NumberFlow
                            value={Math.abs(priceImpact)}
                            format={{
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                              useGrouping: true,
                            }}
                            style={numberFlowStyle}
                          />
                          %
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-help">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-[200px] bg-[#1c2128] border-white/10"
                              >
                                <p className="font-semibold text-red-400 mb-1">High Price Impact</p>
                                <p className="text-xs text-gray-300">
                                  This trade will significantly move the market price. You may
                                  receive less than expected.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                      }
                      tooltip="The difference between market price and estimated price due to trade size"
                      valueClassName="text-red-400"
                    />
                  ) : (
                    <InfoRow
                      label="Fee"
                      value="Free"
                      tooltip="The fee charged for this swap"
                      valueClassName="text-[#3898FF]"
                    />
                  )}
                  <InfoRow
                    label="Network cost"
                    value={
                      intentPath ? (
                        <span className="text-[#3898FF]">Free</span>
                      ) : (
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <Fuel className="h-3.5 w-3.5 text-gray-500" />
                          {gasCostUsd != null ? (
                            <>
                              $
                              <NumberFlow
                                value={gasCostUsd}
                                format={{
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                  useGrouping: true,
                                }}
                                style={numberFlowStyle}
                              />
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      )
                    }
                    tooltip={
                      intentPath
                        ? "No gas fee — relayer submits the transaction"
                        : "Estimated gas fee for this transaction"
                    }
                  />
                </div>

                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center justify-center gap-1.5 w-full py-2 mt-2 rounded-lg hover:bg-white/5 transition-all text-sm text-gray-400 hover:text-white"
                >
                  {isExpanded ? "Show less" : "Show more"}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded
                      ? "max-h-[300px] opacity-100 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                      : "max-h-0 opacity-0"
                  )}
                >
                  <div className="divide-y divide-white/5 pt-2">
                    <InfoRow
                      label="Rate"
                      value={
                        <span className="tabular-nums">
                          1 {tokenIn?.symbol ?? ""} ={" "}
                          {exchangeRate.toLocaleString("en-US", {
                            minimumFractionDigits: rateToStable ? 2 : 0,
                            maximumSignificantDigits: 6,
                            useGrouping: true,
                          })}{" "}
                          {tokenOut?.symbol ?? ""}
                        </span>
                      }
                      tooltip="Current exchange rate between tokens"
                    />
                    <InfoRow
                      label={isMaxIn ? "Maximum sold" : "Minimum received"}
                      value={(() => {
                        const cleanSlippage = slippageLimitFormatted?.replace(/,/g, "") ?? "0"
                        const slippageDecimals = cleanSlippage.includes(".")
                          ? (cleanSlippage.split(".")[1]?.length ?? 0)
                          : 0
                        return (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <NumberFlow
                              value={parseFloat(cleanSlippage) || 0}
                              format={{
                                minimumFractionDigits: 0,
                                maximumFractionDigits: Math.max(6, slippageDecimals),
                                useGrouping: true,
                              }}
                              style={numberFlowStyle}
                            />{" "}
                            {isMaxIn ? (tokenIn?.symbol ?? "") : (tokenOut?.symbol ?? "")}
                          </span>
                        )
                      })()}
                      tooltip={
                        isMaxIn
                          ? "The maximum amount you will pay after slippage"
                          : "The minimum amount you will receive after slippage"
                      }
                    />

                    <InfoRow
                      label="Max slippage"
                      value={
                        <span className="tabular-nums">
                          {(parseFloat(slippage) || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                            useGrouping: true,
                          })}
                          %
                        </span>
                      }
                      tooltip="Maximum price movement allowed before transaction reverts"
                    />

                    <InfoRow
                      label="Order routing"
                      value="Fast Protocol"
                      tooltip="Protocol used to execute this swap"
                    />
                    {impactSeverity === "high" ? (
                      <InfoRow
                        label="Fee"
                        value="Free"
                        tooltip="The fee charged for this swap"
                        valueClassName="text-[#3898FF]"
                      />
                    ) : (
                      <InfoRow
                        label="Price impact"
                        value={
                          <span className="flex items-center gap-1.5 tabular-nums">
                            {`${priceImpact >= 0 ? "" : "-"}${Math.abs(priceImpact).toFixed(2)}%`}
                            {impactSeverity === "medium" && (
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-help">
                                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="max-w-[200px] bg-[#1c2128] border-white/10"
                                  >
                                    <p className="font-semibold text-amber-400 mb-1">
                                      Medium Price Impact
                                    </p>
                                    <p className="text-xs text-gray-300">
                                      This trade may move the market price. Consider a smaller
                                      amount.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </span>
                        }
                        tooltip="The difference between market price and estimated price due to trade size"
                        valueClassName={cn(
                          impactSeverity === "low" && "text-emerald-400",
                          impactSeverity === "medium" && "text-amber-400"
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <div className="p-5 sm:p-6">
                <button
                  onClick={handleConfirm}
                  disabled={ctaState.disabled}
                  className={cn(
                    "w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg transition-all",
                    ctaState.disabled || !isEthereumMainnet
                      ? "bg-white/10 text-gray-500 cursor-not-allowed"
                      : !isWrap && !isUnwrap && impactSeverity === "high"
                        ? "bg-red-500 text-white hover:bg-red-500/90 active:scale-[0.98]"
                        : "bg-[#3898FF] text-white hover:bg-[#3898FF]/90 active:scale-[0.98]"
                  )}
                >
                  {ctaState.showSpinner ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {ctaState.label}
                    </span>
                  ) : (
                    ctaState.label
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ERROR DETAIL MODAL */}
      <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
        <DialogOverlay className="bg-black/40 backdrop-blur-sm z-[60]" />
        <DialogContent className="sm:max-w-2xl w-[95vw] p-0 bg-[#0d1117] border-white/10 rounded-[28px] overflow-hidden shadow-2xl z-[70] outline-none">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-white uppercase tracking-tight">
                Error Log
              </DialogTitle>
              <DialogClose asChild>
                <button className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white">
                  {/* <X className="h-5 w-5" /> */}
                </button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="p-6 pt-2">
            <div className="relative group">
              <div className="w-full bg-black/40 rounded-2xl border border-white/5 p-5 max-h-[50dvh] overflow-y-auto overflow-x-auto scrollbar-hide">
                <code
                  className="text-[12px] leading-relaxed font-mono text-red-400/90 break-words whitespace-pre-wrap"
                  style={{
                    wordBreak: "break-all",
                    overflowWrap: "break-word",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {errorDetailContent}
                </code>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={copyErrorToClipboard}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-2 border border-white/5"
                >
                  {hasCopied ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {hasCopied ? "Copied" : "Copy"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default React.memo(SwapConfirmationModal)
