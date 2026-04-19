"use client"

import React, { useEffect, useMemo, useCallback, useState, useRef } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import type { Token } from "@/types/swap"
import { useWethWrapUnwrap } from "@/hooks/use-weth-wrap-unwrap"
import { useSwapConfirmation } from "@/hooks/use-swap-confirmation"
import { getPriceImpactSeverity } from "@/hooks/use-swap-quote"
import {
  getTransactionErrorTitle,
  getTransactionFullMessage,
  RPCError,
} from "@/lib/settlement/transaction-errors"
import { useAccount } from "wagmi"
import { mainnet } from "wagmi/chains"
import { isStablecoin } from "@/lib/tokens/stablecoins"
import { useTokenPrice } from "@/hooks/use-token-price"
import { useBroadcastGasPrice } from "@/hooks/use-broadcast-gas-price"
import { DEFAULT_ETH_PRICE_USD } from "@/lib/config/constants"
import { GAS_LIMIT_MULTIPLIER, ETH_PATH_DISPLAY_MULTIPLIER } from "@/hooks/use-broadcast-gas-price"
import { useEthPathGasEstimate } from "@/hooks/use-eth-path-gas-estimate"
import { ZERO_ADDRESS } from "@/lib/swap/constants"
import { useSwapToastStore } from "@/stores/swapToastStore"
import { refetchMiles } from "@/hooks/use-user-points"
import { notifySwapSubmitted } from "@/lib/swap/events"
import { ConfirmCtaButton } from "./swap-confirmation/ConfirmCtaButton"
import { ErrorDetailModal } from "./swap-confirmation/ErrorDetailModal"
import { ErrorView } from "./swap-confirmation/ErrorView"
import { SwapDetailsCollapse } from "./swap-confirmation/SwapDetailsCollapse"
import { TransactionSummary } from "./swap-confirmation/TransactionSummary"
import { useSnapshotOnOpen } from "./swap-confirmation/useSnapshotOnOpen"

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
  /** Estimated Fast Miles earned from this swap */
  estimatedMiles?: number | null
  /** Called with the recommended slippage when a barter slippage error is detected. */
  onRetryWithSlippage?: (slippage: string) => void
  /** When true, immediately execute the swap on open (skip review). Used by toast retry flow. */
  autoExecute?: boolean
  /** Called after autoExecute is consumed so parent can reset the flag. */
  onAutoExecuteConsumed?: () => void
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

function SwapConfirmationModal({
  open,
  onOpenChange,
  tokenIn: tokenInLive,
  tokenOut: tokenOutLive,
  amountIn: amountInLive,
  amountOut: amountOutLive,
  minAmountOut: minAmountOutLive,
  slippageLimitFormatted: slippageLimitFormattedLive,
  isMaxIn: isMaxInLive = false,
  exchangeRate: exchangeRateLive,
  priceImpact: priceImpactLive,
  slippage: slippageLive,
  deadline: deadlineLive,
  gasEstimate: gasEstimateLive,
  ethPrice: ethPriceLive,
  fromTokenPrice: fromTokenPriceLive,
  toTokenPrice: toTokenPriceLive,
  isLoading = false,
  refreshBalances,
  onCloseAfterSuccess,
  setClearSwapState,
  needsPermit2Approval = false,
  isApproving = false,
  isApprovalRejected = false,
  approvalTxHash,
  onApprove,
  estimatedMiles: estimatedMilesLive,
  onRetryWithSlippage,
  autoExecute = false,
  onAutoExecuteConsumed,
  externalError,
}: SwapConfirmationModalProps) {
  // Snapshot quote-dependent values when the modal opens so they stay static
  // during the review — live quote refreshes should not shift the numbers.
  const {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    minAmountOut,
    slippageLimitFormatted,
    isMaxIn,
    exchangeRate,
    priceImpact,
    slippage,
    deadline,
    gasEstimate,
    ethPrice,
    fromTokenPrice,
    toTokenPrice,
    estimatedMiles,
  } = useSnapshotOnOpen(open, {
    tokenIn: tokenInLive,
    tokenOut: tokenOutLive,
    amountIn: amountInLive,
    amountOut: amountOutLive,
    minAmountOut: minAmountOutLive,
    slippageLimitFormatted: slippageLimitFormattedLive,
    isMaxIn: isMaxInLive,
    exchangeRate: exchangeRateLive,
    priceImpact: priceImpactLive,
    slippage: slippageLive,
    deadline: deadlineLive,
    gasEstimate: gasEstimateLive,
    ethPrice: ethPriceLive,
    fromTokenPrice: fromTokenPriceLive,
    toTokenPrice: toTokenPriceLive,
    estimatedMiles: estimatedMilesLive,
  })

  // --- EXTERNAL HOOKS ---
  const { chain: signerChain, isConnected } = useAccount()

  // If signerChain is undefined, the wallet isn't connected to a signer yet.
  const isEthereumMainnet = useMemo(
    () => isConnected && signerChain?.id === mainnet.id,
    [isConnected, signerChain]
  )

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
  const setFailed = useSwapToastStore((s) => s.setFailed)
  const clearLastTxError = useSwapToastStore((s) => s.clearLastTxError)

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
  const [isConfirming, setIsConfirming] = useState(false)
  const [isApprovalInProgress, setIsApprovalInProgress] = useState(false)
  const [isAutoSwappingAfterApproval, setIsAutoSwappingAfterApproval] = useState(false)
  const prevNeedsApprovalRef = useRef(needsPermit2Approval)

  // Swap errors → route to toast and close modal
  useEffect(() => {
    if (!swapError) return
    const placeholder = `error-${Date.now()}`
    addToast(placeholder, tokenIn, tokenOut, amountIn, amountOut)
    setFailed(placeholder, undefined, swapError.message)
    resetSwap()
    onOpenChange(false)
  }, [swapError]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset accordion when modal closes so it starts collapsed on next open
  useEffect(() => {
    if (!open) setIsExpanded(false)
  }, [open])

  // When user cancels approval in wallet, reset so they can try again
  useEffect(() => {
    if (isApprovalRejected) setIsApprovalInProgress(false)
  }, [isApprovalRejected])

  const operationType = isWrap ? "wrap" : isUnwrap ? "unwrap" : "swap"
  const impactSeverity: "low" | "medium" | "high" = useMemo(
    () => (isWrap || isUnwrap ? "low" : getPriceImpactSeverity(priceImpact)),
    [isWrap, isUnwrap, priceImpact]
  )

  const intentPath = Boolean(
    !isWrap && !isUnwrap && tokenIn && tokenIn.address?.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
  )

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
        onCloseAfterSuccess?.()
        if (refreshBalances) setTimeout(() => refreshBalances(), 1000)
        setTimeout(() => refetchMiles(), 5000)
      }
      if (isWrap) {
        const hash = await wrap()
        notifySwapSubmitted(hash, estimatedMiles)
        addToast(hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onCloseAfterSuccess)
        onCloseAfterSuccess?.()
        onOpenChange(false)
      } else if (isUnwrap) {
        const hash = await unwrap()
        notifySwapSubmitted(hash, estimatedMiles)
        addToast(hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onCloseAfterSuccess)
        onCloseAfterSuccess?.()
        onOpenChange(false)
      } else {
        const hash = await confirmSwap({
          onPendingHash: (ph) => {
            pendingPlaceholder = ph
            addToast(ph, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onCloseAfterSuccess)
            onCloseAfterSuccess?.()
            onOpenChange(false) // Close modal immediately; toast takes over
          },
        })
        // Fire the swap-submitted event with the final (real) tx hash so
        // the dashboard table starts polling for its fastswap_miles row
        // regardless of whether the user is currently viewing it.
        notifySwapSubmitted(hash, estimatedMiles)
        if (pendingPlaceholder) {
          updateToastHash(pendingPlaceholder, hash)
        } else {
          addToast(hash, tokenIn, tokenOut, amountIn, amountOut, onConfirm, onCloseAfterSuccess)
          onCloseAfterSuccess?.()
        }
        onOpenChange(false)
      }
    } catch (err) {
      if (pendingPlaceholder) {
        // Modal already closed (permit path); show error in the toast instead
        const message = err instanceof Error ? err.message : "Transaction failed"
        setFailed(pendingPlaceholder, undefined, message)
      }
      // Barter slippage errors are handled by the swapError effect above.
      // Other errors are set by hooks (wrapError/swapError); ERROR VIEW renders.
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
    setFailed,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    setClearSwapState,
    refreshBalances,
    onCloseAfterSuccess,
    onOpenChange,
  ])

  // Auto-execute on open (toast retry flow): skip review, go straight to wallet
  useEffect(() => {
    if (open && autoExecute) {
      onAutoExecuteConsumed?.()
      executeSwap()
    }
  }, [open, autoExecute, onAutoExecuteConsumed, executeSwap])

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

  // USD value under each token amount
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

  // Auto-execute retry: mount hooks + effect only, no visible UI (toast handles feedback)
  if (autoExecute && open) return null

  const isDangerous = !isWrap && !isUnwrap && impactSeverity === "high"

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
            <ErrorView
              error={activeError}
              occurredAfterPreConfirm={externalError?.occurredAfterPreConfirm}
              onOpenDetails={() => setIsErrorModalOpen(true)}
              onRetry={() => {
                resetAllStates()
                clearLastTxError()
                executeSwap()
              }}
              onRetryWithSlippage={(recommended) => {
                resetAllStates()
                clearLastTxError()
                onRetryWithSlippage?.(recommended)
              }}
            />
          ) : (
            <div className="animate-in fade-in duration-300">
              <TransactionSummary
                tokenIn={tokenIn}
                tokenOut={tokenOut}
                amountIn={amountIn}
                amountOut={amountOut}
                fromUsdValue={fromUsdValue}
                toUsdValue={toUsdValue}
              />

              <SwapDetailsCollapse
                priceImpact={priceImpact}
                impactSeverity={impactSeverity}
                intentPath={intentPath}
                gasCostUsd={gasCostUsd}
                isWrap={isWrap}
                isUnwrap={isUnwrap}
                estimatedMiles={estimatedMiles}
                isExpanded={isExpanded}
                onToggleExpanded={() => setIsExpanded(!isExpanded)}
                tokenIn={tokenIn}
                tokenOut={tokenOut}
                exchangeRate={exchangeRate}
                rateToStable={rateToStable}
                isMaxIn={isMaxIn}
                slippageLimitFormatted={slippageLimitFormatted}
                slippage={slippage}
              />

              <ConfirmCtaButton
                label={ctaState.label}
                disabled={ctaState.disabled}
                showSpinner={ctaState.showSpinner}
                onClick={handleConfirm}
                isEthereumMainnet={isEthereumMainnet}
                isDangerous={isDangerous}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ErrorDetailModal
        open={isErrorModalOpen}
        onOpenChange={setIsErrorModalOpen}
        content={errorDetailContent}
      />
    </>
  )
}

export default React.memo(SwapConfirmationModal)
