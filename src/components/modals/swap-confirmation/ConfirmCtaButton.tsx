"use client"

import { cn } from "@/lib/utils"

export interface ConfirmCtaButtonProps {
  label: string
  disabled: boolean
  showSpinner: boolean
  onClick: () => void
  // Layout hints only — the button doesn't own the business rules.
  isEthereumMainnet: boolean
  /** High-impact swaps (≥ 5%) flip the button red so the user doesn't sleepwalk into a bad trade. */
  isDangerous: boolean
}

// Renders the bottom CTA of the swap-confirmation modal.
// Disabled style wins regardless of network/danger (it's always grey),
// then isDangerous (red) beats the normal blue. Keep this visual
// precedence here so the parent doesn't have to duplicate the logic.
export function ConfirmCtaButton({
  label,
  disabled,
  showSpinner,
  onClick,
  isEthereumMainnet,
  isDangerous,
}: ConfirmCtaButtonProps) {
  return (
    <div className="p-5 sm:p-6">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg transition-all",
          disabled || !isEthereumMainnet
            ? "bg-white/10 text-gray-500 cursor-not-allowed"
            : isDangerous
              ? "bg-red-500 text-white hover:bg-red-500/90 active:scale-[0.98]"
              : "bg-[#3898FF] text-white hover:bg-[#3898FF]/90 active:scale-[0.98]"
        )}
      >
        {showSpinner ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {label}
          </span>
        ) : (
          label
        )}
      </button>
    </div>
  )
}
