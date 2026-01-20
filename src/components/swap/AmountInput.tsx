"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import type { Token } from "@/types/swap"
import TokenSelector from "./TokenSelector"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface AmountInputProps {
  label: string
  value: string
  onChange?: (value: string) => void
  selectedToken: Token | undefined
  onTokenSelect: (token: Token) => void
  tokens: Token[]
  // NEW: distinguish between the side being typed in and the side being quoted
  isFollower?: boolean
  onMaxClick?: () => void
  showMax?: boolean
  // NEW: notify parent when this box is clicked/focused
  onFocus?: () => void
}

export default function AmountInput({
  label,
  value,
  onChange,
  selectedToken,
  onTokenSelect,
  tokens,
  isFollower = false,
  onMaxClick,
  showMax = false,
  onFocus,
}: AmountInputProps) {
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false)

  return (
    <div
      className={cn(
        "p-3 border rounded-xl transition-all duration-200",
        !isFollower
          ? "bg-[#222] border-white/20 shadow-lg"
          : "bg-muted/30 border-border/50 hover:bg-muted/50"
      )}
      onClick={onFocus} // Ensure clicking the container sets the editing side
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
        {showMax && !isFollower && onMaxClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onMaxClick()
            }}
            className="h-6 text-[10px] font-bold bg-white/5 hover:bg-white/10"
          >
            MAX
          </Button>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          // Only allow typing if this is NOT the follower side
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, "")
            if (!isFollower) onChange?.(val)
          }}
          onFocus={onFocus}
          // We use readOnly instead of disabled to keep the UI clean
          readOnly={isFollower}
          className={cn(
            "flex-1 text-2xl font-semibold tabular-nums border-0 bg-transparent focus-visible:ring-0 p-0 h-auto placeholder:text-muted-foreground/20",
            // Add a subtle pulse to the value if it's a quote being fetched
            isFollower && value === "" && "animate-pulse"
          )}
        />

        <Button
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            setIsTokenSelectorOpen(true)
          }}
          className="flex items-center gap-2 px-3 h-10 border-border/50 bg-[#1B1B1B] hover:border-primary/50 rounded-xl"
        >
          {selectedToken ? (
            <>
              {selectedToken.logoURI && (
                <img src={selectedToken.logoURI} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="font-bold text-sm">{selectedToken.symbol}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm font-bold">Select</span>
          )}
          <ChevronDown size={14} className="text-muted-foreground" />
        </Button>
      </div>

      <TokenSelector
        open={isTokenSelectorOpen}
        onOpenChange={setIsTokenSelectorOpen}
        tokens={tokens}
        selectedToken={selectedToken}
        onSelect={onTokenSelect}
      />
    </div>
  )
}
