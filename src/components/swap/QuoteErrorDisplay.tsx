"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"

interface QuoteErrorDisplayProps {
  error: Error | null
  show: boolean
}

export default React.memo(function QuoteErrorDisplay({ error, show }: QuoteErrorDisplayProps) {
  if (!show || !error) return null

  return (
    <div className="px-4 py-2">
      <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
        <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-red-500">Quote Error</p>
          <p className="text-xs text-red-500/80 mt-0.5">
            {error.message || "Failed to fetch quote. Please try again."}
          </p>
        </div>
      </div>
    </div>
  )
})
