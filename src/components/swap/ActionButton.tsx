"use client"

import React from "react"
// UI Components
import { Button } from "@/components/ui/button"
import { ConnectButton } from "@rainbow-me/rainbowkit"

// Types
import { Token } from "@/types/swap"

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
  isWrap: boolean
  isUnwrap: boolean
  handleSwapClick: () => void
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  isConnected,
  toToken,
  amount,
  insufficientBalance,
  isWrap,
  isUnwrap,
  handleSwapClick,
}) => {
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
   * 2. VALIDATION & SWAP LOGIC
   * Once connected, we check for token selection, input amounts,
   * and balance sufficiency before allowing the swap action.
   */
  return (
    <div className="mt-3 sm:mt-4">
      {!toToken ? (
        // Case: No destination token selected
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl bg-white/10 text-gray-500 cursor-not-allowed"
        >
          Select a token
        </Button>
      ) : !amount || amount === "0" ? (
        // Case: Token is selected but no amount has been entered
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl bg-white/10 text-gray-500 cursor-not-allowed"
        >
          Enter an amount
        </Button>
      ) : insufficientBalance ? (
        // Case: Amount exceeds user's current balance
        <Button
          disabled
          className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed"
        >
          Insufficient Balance
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
