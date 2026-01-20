"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import type { Token } from "@/types/swap"
import TokenSelector from "./TokenSelector"
import { useState } from "react"

interface AmountInputProps {
  label: string
  value: string
  onChange?: (value: string) => void
  selectedToken: Token | undefined
  onTokenSelect: (token: Token) => void
  tokens: Token[]
  readOnly?: boolean
  onMaxClick?: () => void
  showMax?: boolean
}

export default function AmountInput({
  label,
  value,
  onChange,
  selectedToken,
  onTokenSelect,
  tokens,
  readOnly = false,
  onMaxClick,
  showMax = false,
}: AmountInputProps) {
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false)

  return (
    <div className="p-3 bg-muted/30 border border-border/50 rounded-xl hover:border-primary/50 hover:bg-muted/50 transition-all duration-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        {showMax && !readOnly && onMaxClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMaxClick}
            className="h-6 text-xs font-medium hover:text-primary"
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
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          disabled={readOnly}
          className="flex-1 text-xl font-semibold tabular-nums border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto placeholder:text-muted-foreground/30"
        />
        <Button
          variant="outline"
          onClick={() => setIsTokenSelectorOpen(true)}
          className="flex items-center gap-2 px-3 h-10 border-border/50 bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-all duration-200 rounded-xl"
        >
          {selectedToken ? (
            <>
              {selectedToken.logoURI && (
                <img
                  src={selectedToken.logoURI}
                  alt={selectedToken.symbol}
                  className="w-5 h-5 rounded-full"
                />
              )}
              <span className="font-medium text-sm">{selectedToken.symbol}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">Select</span>
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
