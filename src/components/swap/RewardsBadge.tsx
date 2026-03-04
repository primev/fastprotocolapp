"use client"

import React from "react"
import Image from "next/image"

interface RewardsBadgeProps {
  estimatedMiles?: number | null
}

const RewardsBadgeComponent = ({ estimatedMiles }: RewardsBadgeProps) => {
  const hasMiles = estimatedMiles != null && estimatedMiles > 0
  const noMiles = estimatedMiles != null && estimatedMiles <= 0

  return (
    <div className="mt-6 flex justify-center min-h-[40px]">
      <div
        className={
          noMiles
            ? "inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
            : "inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 backdrop-blur-sm"
        }
      >
        {!noMiles && (
          <div className="relative flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <div className="absolute h-2 w-2 rounded-full bg-primary animate-ping opacity-75" />
          </div>
        )}
        <span
          className={
            noMiles
              ? "text-[11px] sm:text-xs font-medium text-gray-400"
              : "text-[11px] sm:text-xs font-medium text-primary"
          }
        >
          {hasMiles
            ? `~${estimatedMiles.toLocaleString("en-US")} miles`
            : noMiles
              ? "Swap too small to earn miles"
              : "Earning Fast Rewards"}
        </span>
        <Image
          src="/assets/fast-icon.png"
          alt="Fast"
          width={28}
          height={28}
          className={noMiles ? "h-7 w-7 sm:h-8 sm:w-8 opacity-40" : "h-7 w-7 sm:h-8 sm:w-8"}
          unoptimized
        />
      </div>
    </div>
  )
}

export const RewardsBadge = React.memo(RewardsBadgeComponent)
