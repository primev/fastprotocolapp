"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"

interface QuoteErrorDisplayProps {
  error: Error | null
  show: boolean
}

export default React.memo(function QuoteErrorDisplay({ error, show }: QuoteErrorDisplayProps) {
  if (!show || !error) return null

  // Map error messages to user-friendly Uniswap-style messages
  const getUserFriendlyMessage = (error: Error): string => {
    const message = error.message.toLowerCase()

    if (message.includes("no liquidity") || message.includes("liquidity")) {
      return "No liquidity available for this pair. Try a different token pair."
    }
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("fetch")
    ) {
      return "Network error. Please check your connection and try again."
    }
    if (message.includes("timeout") || message.includes("time out")) {
      return "Request timed out. Please try again."
    }
    if (message.includes("insufficient") || message.includes("balance")) {
      return "Insufficient balance for this swap."
    }
    if (message.includes("invalid") || message.includes("invalid")) {
      return "Invalid swap parameters. Please check your inputs."
    }

    // Return original message if no match, but make it more user-friendly
    return error.message || "Unable to fetch quote. Please try again."
  }

  return (
    <div className="px-4 py-2">
      <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
        <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-red-500">Unable to get quote</p>
          <p className="text-xs text-red-500/80 mt-0.5">{getUserFriendlyMessage(error)}</p>
        </div>
      </div>
    </div>
  )
})
