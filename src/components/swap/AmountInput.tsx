"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
    <Card className="p-4 bg-background/60 backdrop-blur-xl border-white/10">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {showMax && !readOnly && onMaxClick && (
          <Button variant="ghost" size="sm" onClick={onMaxClick} className="h-6 text-xs">
            MAX
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          disabled={readOnly}
          className="flex-1 text-2xl font-semibold border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
        />
        <Button
          variant="outline"
          onClick={() => setIsTokenSelectorOpen(true)}
          className="flex items-center gap-2 min-w-[120px]"
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
              <span className="font-medium">{selectedToken.symbol}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select</span>
          )}
          <ChevronDown size={16} />
        </Button>
      </div>
      <TokenSelector
        open={isTokenSelectorOpen}
        onOpenChange={setIsTokenSelectorOpen}
        tokens={tokens}
        selectedToken={selectedToken}
        onSelect={onTokenSelect}
      />
    </Card>
  )
}
