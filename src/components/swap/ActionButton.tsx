"use client"

import React, { useEffect, useState } from "react"
// UI Components
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"

// Types
import { Token } from "@/types/swap"
import { useGateStatus } from "@/hooks/use-gate-status"

/** Delay before trusting "disconnected" so we don't flash Connect Wallet during rehydration */
const CONNECTION_SETTLE_MS = 200

/**
 * Interface for the ActionButton component.
 * Includes only the specific state flags required to determine
 * which button variant to render.
 */
interface ActionButtonProps {
  isConnected: boolean
  toToken: Token | null
  amount: string
  insufficientBalance: boolean
  hasNoLiquidity: boolean
  barterAmountTooSmall: boolean
  isBarterValidating: boolean
  isWrap: boolean
  isUnwrap: boolean
  handleSwapClick: () => void
  isNonceLoading?: boolean
}

const ActionButtonComponent: React.FC<ActionButtonProps> = ({
  isConnected,
  toToken,
  amount,
  insufficientBalance,
  hasNoLiquidity,
  barterAmountTooSmall,
  isBarterValidating,
  isWrap,
  isUnwrap,
  handleSwapClick,
  isNonceLoading = false,
}) => {
  const { status } = useAccount()
  const { isPreApproved, isLoading: isWhitelistLoading } = useGateStatus()
  const [connectionSettled, setConnectionSettled] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setConnectionSettled(true), CONNECTION_SETTLE_MS)
    return () => clearTimeout(t)
  }, [])

  const connectionUnsettled =
    !connectionSettled || status === "connecting" || status === "reconnecting"

  /**
   * 0. WAIT FOR CONNECTION STATE TO SETTLE
   * Show skeleton until wagmi has finished reconnecting (and a short delay
   * has passed) so we don't flash "Connect Wallet" when the user is already
   * connected (rehydration).
   */
  if (connectionUnsettled) {
    return (
      <div className="mt-3 sm:mt-4">
        <Skeleton className="h-12 w-full sm:h-[54px] rounded-xl sm:rounded-2xl" />
      </div>
    )
  }

  /**
   * 1. WALLET CONNECTION CHECK
   * The highest priority state. If the user isn't connected, we
   * defer to the RainbowKit ConnectButton custom implementation.
   */
  if (!isConnected) {
    return (
      <div className="mt-3 sm:mt-4">
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <Button
              onClick={openConnectModal}
              className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-gradient-to-r from-pink-500 to-primary hover:opacity-90 transition-all active:scale-[0.98]"
            >
              Connect Wallet
            </Button>
          )}
        </ConnectButton.Custom>
      </div>
    )
  }

  /**
   * 2. WHITELIST LOADING
   * Show skeleton so the CTA doesn't switch states before whitelist result settles.
   */
  if (isWhitelistLoading) {
    return (
      <div className="mt-3 sm:mt-4">
        <Skeleton className="h-12 w-full sm:h-[54px] rounded-xl sm:rounded-2xl" />
      </div>
    )
  }

  /**
   * 3. WHITELIST GATING
   * Connected but not on Swap Whitelist: same-styled button, disabled, "Come back at launch".
   */
  if (!isPreApproved) {
    return (
      <div className="mt-3 sm:mt-4">
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-gradient-to-r from-pink-500 to-primary hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Come back at launch
        </Button>
      </div>
    )
  }

  /**
   * 4. VALIDATION & SWAP LOGIC
   * Once connected and whitelisted, we check for token selection, input amounts,
   * and balance sufficiency before allowing the swap action.
   */
  return (
    <div className="mt-3 sm:mt-4">
      {!toToken ? (
        // Case: No destination token selected
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-not-allowed"
        >
          Select a token
        </Button>
      ) : !amount || amount === "0" ? (
        // Case: Token is selected but no amount has been entered
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-not-allowed"
        >
          Enter an amount
        </Button>
      ) : insufficientBalance ? (
        // Case: Amount exceeds user's current balance
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-not-allowed"
        >
          Insufficient balance
        </Button>
      ) : hasNoLiquidity ? (
        // Case: No Uniswap pool / route exists for this pair
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-not-allowed"
        >
          This trade cannot be completed right now
        </Button>
      ) : barterAmountTooSmall ? (
        // Case: Amount too small for Barter to route within max slippage
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-amber-500/10 text-amber-400 cursor-not-allowed border border-amber-500/20"
        >
          Amount too small to swap
        </Button>
      ) : isBarterValidating ? (
        // Case: Validating route with Barter
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-wait"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 border-2 border-gray-400/50 border-t-gray-400 rounded-full animate-spin" />
            Calculating...
          </span>
        </Button>
      ) : isNonceLoading ? (
        // Case: Permit path - waiting for nonce bitmap to load
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-white/10 text-gray-500 cursor-wait"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 border-2 border-gray-400/50 border-t-gray-400 rounded-full animate-spin" />
            Initializing...
          </span>
        </Button>
      ) : (
        // Case: All checks passed - Ready to Swap, Wrap, or Unwrap
        <Button
          onClick={handleSwapClick}
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg bg-gradient-to-r from-pink-500 to-primary hover:opacity-90 transition-all active:scale-[0.98]"
        >
          {isWrap ? "Wrap" : isUnwrap ? "Unwrap" : "Swap"}
        </Button>
      )}
    </div>
  )
}

export const ActionButton = React.memo(ActionButtonComponent)
