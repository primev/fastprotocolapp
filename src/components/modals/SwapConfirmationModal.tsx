"use client"

import React, { useEffect, useMemo, useCallback, useState } from "react"
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
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  Info,
  ExternalLink,
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
} from "@/lib/transaction-errors"
import { useAccount } from "wagmi"
import { mainnet } from "wagmi/chains"
import { useTokenPrice } from "@/hooks/use-token-price"
import { DEFAULT_ETH_PRICE_USD } from "@/lib/constants"
import { GAS_LIMIT_MULTIPLIER } from "@/hooks/use-broadcast-gas-price"
import { useEthPathGasEstimate } from "@/hooks/use-eth-path-gas-estimate"

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
  isAutoSlippage: boolean
  ethPrice?: number | null
  /** USD price per token for the "from" token (used for USD under amount). */
  fromTokenPrice?: number | null
  /** USD price per token for the "to" token (used for USD under amount). */
  toTokenPrice?: number | null
  timeLeft?: number
  isLoading?: boolean
  refreshBalances?: () => Promise<void>
  /** Called when the user closes the modal after a successful transaction. Use to reset parent form state. */
  onCloseAfterSuccess?: () => void
  setClearSwapState: (clear: boolean) => void
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

function TokenIcon({ token, className }: { token: Token | undefined; className?: string }) {
  const [hasImageError, setHasImageError] = useState(false)
  useEffect(() => {
    if (token) setHasImageError(false)
  }, [token?.address])
  if (!token) return null
  return (
    <div
      className={cn(
        "rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden p-2.5",
        className
      )}
    >
      {token.logoURI && !hasImageError ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className="h-full w-full object-contain"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span className="text-[10px] font-bold text-white uppercase">{token.symbol.charAt(0)}</span>
      )}
    </div>
  )
}

function BuyReceiveValue({ value, className }: { value: string; className?: string }) {
  const clean = value?.replace(/,/g, "") ?? ""
  const numeric = clean && !Number.isNaN(parseFloat(clean)) ? parseFloat(clean) : null
  const decimalPlaces = clean.includes(".") ? (clean.split(".")[1]?.length ?? 0) : 0
  const minFractionDigits = Math.min(decimalPlaces, 6)

  if (numeric === null) {
    return <span className={className}>{value || "0"}</span>
  }

  return (
    <span className={className}>
      <NumberFlow
        value={numeric}
        format={{
          minimumFractionDigits: minFractionDigits,
          maximumFractionDigits: 6,
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
  isAutoSlippage,
  ethPrice,
  fromTokenPrice,
  toTokenPrice,
  timeLeft,
  isLoading = false,
  refreshBalances,
  onCloseAfterSuccess,
  setClearSwapState,
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
    isPending: isWrapPending, // Wallet Signature Phase
    isConfirming: isWrapConfirming, // Blockchain Inclusion Phase
    isSuccess: isWrapSuccess,
    error: wrapError,
    hash: wrapHash,
    reset: resetWrap,
    gasEstimate: wethGasEstimate, // This will update every 12s
  } = useWethWrapUnwrap({
    fromToken: tokenIn,
    toToken: tokenOut,
    amount: amountIn,
  })

  const {
    confirmSwap,
    isSigning,
    isSubmitting,
    hash: swapHash,
    error: swapError,
    reset: resetSwap,
  } = useSwapConfirmation({
    fromToken: tokenIn,
    toToken: tokenOut,
    amount: amountIn,
    minAmountOut,
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

  // For ETH-path swaps, estimate gas on the actual tx to match wallet display
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

  // Reset accordion when modal closes so it starts collapsed on next open
  useEffect(() => {
    if (!open) setIsExpanded(false)
  }, [open])

  // --- LOGIC PHASES ---
  const isWaitingForSignature = isWrapPending || isSigning
  const isCurrentlyError = !!wrapError || !!swapError
  const isWaitingForBlock = (isWrapConfirming || isSubmitting) && !isCurrentlyError
  const isSwapSuccess = !!swapHash && !isSigning && !isSubmitting && !swapError
  const isCurrentlySuccess = (isWrapSuccess || isSwapSuccess) && !isCurrentlyError
  const activeHash = wrapHash || swapHash

  const isActive =
    isWaitingForSignature || isWaitingForBlock || isCurrentlySuccess || isCurrentlyError
  const operationType = isWrap ? "wrap" : isUnwrap ? "unwrap" : "swap"
  const impactSeverity = useMemo(
    () => (isWrap || isUnwrap ? "low" : getPriceImpactSeverity(priceImpact)),
    [isWrap, isUnwrap, priceImpact]
  )

  // --- ACTIONS ---
  const resetAllStates = useCallback(() => {
    if (resetWrap) resetWrap()
    if (resetSwap) resetSwap()
    setIsErrorModalOpen(false)
  }, [resetWrap, resetSwap])

  const activeGasEstimate = useMemo(() => {
    if (isWrap || isUnwrap) return wethGasEstimate
    // Use ETH-path estimate when available (matches wallet); else fall back to quote
    const base = ethPathGasEstimate ?? gasEstimate
    if (!base) return null
    return (base * GAS_LIMIT_MULTIPLIER) / 100n
  }, [isWrap, isUnwrap, wethGasEstimate, ethPathGasEstimate, gasEstimate])

  const handleOpenChange = (isOpen: boolean) => {
    // BLOCK CLOSING during active transaction phases
    if (!isOpen && (isWaitingForSignature || isWaitingForBlock)) return

    if (!isOpen) {
      // If we are closing a SUCCESSFUL modal, clear the parent form
      if (isCurrentlySuccess) {
        if (refreshBalances) refreshBalances()

        // This ensures the parent "Clear state" logic runs for BOTH Weth and Swaps
        setClearSwapState(true)

        onCloseAfterSuccess?.()
      }

      // Reset the internal hook states (hashes, errors, etc.)
      resetAllStates()
    }
    onOpenChange(isOpen)
  }

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

  const activeError = wrapError || swapError

  const errorTitle = useMemo(
    () => getTransactionErrorTitle(activeError, operationType),
    [activeError, operationType]
  )

  const copyErrorToClipboard = useCallback(() => {
    if (!activeError) return
    navigator.clipboard.writeText(getTransactionFullMessage(activeError))
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }, [activeError])

  // Rate is "tokenOut per 1 tokenIn"; format by whether tokenOut is stable (match swap form)
  const rateToStable = useMemo(
    () => isStablecoin(tokenOut?.address ?? "", tokenOut?.symbol),
    [tokenOut?.address, tokenOut?.symbol]
  )

  // Refresh balances when wrap/unwrap succeeds
  useEffect(() => {
    if (isWrapSuccess && refreshBalances) {
      // Small delay to ensure transaction is fully confirmed on-chain
      const timeoutId = setTimeout(() => {
        refreshBalances()
      }, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [isWrapSuccess, refreshBalances])

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
                {isCurrentlyError
                  ? errorTitle
                  : isActive
                    ? "Transaction Status"
                    : "You're swapping"}
              </DialogTitle>
              {!(isWaitingForSignature || isWaitingForBlock) && (
                <DialogClose asChild>
                  <button
                    onClick={() => handleOpenChange(false)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-400 hover:text-white" />
                  </button>
                </DialogClose>
              )}
            </div>
          </DialogHeader>

          {isActive ? (
            /* STATUS VIEW */
            <div className="flex flex-col items-center pb-10 px-8 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="relative mb-8">
                <div
                  className={cn(
                    "absolute inset-0 blur-3xl rounded-full scale-150 opacity-40 transition-colors duration-500",
                    isCurrentlySuccess
                      ? "bg-emerald-500"
                      : isCurrentlyError
                        ? "bg-red-500"
                        : "bg-primary"
                  )}
                />

                {isCurrentlySuccess ? (
                  <CheckCircle2 className="h-20 w-20 text-emerald-500 relative z-10" />
                ) : isCurrentlyError ? (
                  <XCircle className="h-20 w-20 text-red-500 relative z-10" />
                ) : (
                  <div className="relative">
                    <Loader2 className="h-20 w-20 text-primary animate-spin relative z-10" />
                    {isWaitingForBlock && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <h3
                  className={cn(
                    "text-xl font-bold uppercase tracking-tight",
                    isCurrentlyError ? "text-red-500" : "text-white"
                  )}
                >
                  {isCurrentlyError
                    ? "Failed"
                    : isCurrentlySuccess
                      ? "Confirmed"
                      : isWaitingForBlock
                        ? "Processing Transaction"
                        : "Sign Transaction"}
                </h3>

                <div className="flex flex-col items-center gap-2">
                  <p className="text-[14px] font-medium text-white/75 max-w-[320px] leading-relaxed">
                    {isCurrentlySuccess
                      ? "Transaction successfully completed."
                      : isCurrentlyError
                        ? getTransactionShortMessage(activeError)
                        : isWaitingForBlock
                          ? "Waiting for network confirmation..."
                          : "Please confirm the request in your wallet."}
                  </p>

                  {isCurrentlyError && (
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
                  )}
                </div>
              </div>

              {activeHash && (
                <a
                  href={`https://etherscan.io/tx/${activeHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 mb-8 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                >
                  View on Explorer <ExternalLink size={12} />
                </a>
              )}

              <div className="flex flex-col w-full gap-3">
                {isCurrentlyError && (
                  <button
                    onClick={resetAllStates}
                    className="w-full h-14 bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl transition-all flex items-center justify-center gap-3"
                  >
                    <RefreshCw size={16} /> Try Again
                  </button>
                )}
              </div>
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
                    }
                    tooltip="Estimated gas fee for this transaction"
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
                            maximumFractionDigits: 6,
                            useGrouping: true,
                          })}{" "}
                          {tokenOut?.symbol ?? ""}
                        </span>
                      }
                      tooltip="Current exchange rate between tokens"
                    />
                    <InfoRow
                      label={isMaxIn ? "Maximum sold" : "Minimum received"}
                      value={
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <NumberFlow
                            value={
                              parseFloat(slippageLimitFormatted?.replace(/,/g, "") ?? "0") || 0
                            }
                            format={{
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 6,
                              useGrouping: true,
                            }}
                            style={numberFlowStyle}
                          />{" "}
                          {isMaxIn ? (tokenIn?.symbol ?? "") : (tokenOut?.symbol ?? "")}
                        </span>
                      }
                      tooltip={
                        isMaxIn
                          ? "The maximum amount you will pay after slippage"
                          : "The minimum amount you will receive after slippage"
                      }
                    />
                    <InfoRow
                      label="Max slippage"
                      value={
                        <span className="flex items-center gap-2 tabular-nums">
                          {isAutoSlippage && (
                            <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-medium">
                              Auto
                            </span>
                          )}
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
                  onClick={() => (isWrap ? wrap() : isUnwrap ? unwrap() : confirmSwap())}
                  disabled={isLoading || !isEthereumMainnet}
                  className={cn(
                    "w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg transition-all active:scale-[0.98]",
                    !isEthereumMainnet
                      ? "bg-white/10 text-gray-500 cursor-not-allowed"
                      : !isWrap && !isUnwrap && impactSeverity === "high"
                        ? "bg-red-500 text-white hover:bg-red-500/90"
                        : "bg-[#3898FF] text-white hover:bg-[#3898FF]/90"
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Fetching...
                    </span>
                  ) : !isEthereumMainnet ? (
                    "Connect to Ethereum"
                  ) : !isWrap && !isUnwrap && impactSeverity === "high" ? (
                    "Swap Anyway"
                  ) : (
                    `Confirm ${operationType}`
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
                  {getTransactionFullMessage(activeError ?? null)}
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
