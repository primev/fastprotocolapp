"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ArrowUpDown, Settings2, ChevronDown, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useBalance, useAccount } from "wagmi"
import { formatUnits } from "viem"
import { cn } from "@/lib/utils"
import TokenSelector from "./TokenSelector"
import SwapQuoter from "./SwapQuoter"
import { useSwapQuote } from "@/hooks/use-swap-quote"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import { INTENT_DEADLINE_MINUTES } from "@/lib/swap-constants"
import type { Token } from "@/types/swap"

const DEADLINE_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "12h", value: 720 },
]

const STORAGE_KEY = "swap-intent-deadline-minutes"

interface SwapInterfaceProps {
  tokens: Token[]
  isLoading?: boolean
}

export default function SwapInterface({ tokens, isLoading = false }: SwapInterfaceProps) {
  const { createIntentSignature } = useSwapIntent()
  const { nonce, refetchNonce } = usePermit2Nonce()
  const { address } = useAccount()

  // Load deadline preference from localStorage
  const [deadlineMinutes, setDeadlineMinutes] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (!isNaN(parsed) && parsed >= 5 && parsed <= 1440) {
          return parsed
        }
      }
    }
    return INTENT_DEADLINE_MINUTES
  })

  // Save deadline preference to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, deadlineMinutes.toString())
    }
  }, [deadlineMinutes])

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [tokenIn, setTokenIn] = useState<Token | undefined>(tokens?.[0])
  const [tokenOut, setTokenOut] = useState<Token | undefined>(tokens?.[1])
  const [amountIn, setAmountIn] = useState("")
  const [isSigning, setIsSigning] = useState(false)
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState<"in" | "out" | null>(null)

  // Update tokens when they change
  React.useEffect(() => {
    if (tokens.length > 0 && !tokenIn) {
      setTokenIn(tokens[0])
    }
    if (tokens.length > 1 && !tokenOut) {
      setTokenOut(tokens[1])
    }
  }, [tokens, tokenIn, tokenOut])

  // Fetch token balance for the selected input token
  const { data: tokenBalance } = useBalance({
    address,
    token: tokenIn?.address as `0x${string}` | undefined,
  })

  // Calculate balance in token units
  const balance = useMemo(() => {
    if (!tokenBalance || !tokenIn) return "0"
    try {
      return formatUnits(tokenBalance.value, tokenIn.decimals)
    } catch {
      return "0"
    }
  }, [tokenBalance, tokenIn])

  // Swap quote logic
  const { quote, timeLeft, isRefreshing } = useSwapQuote({ tokenIn, tokenOut, amountIn })

  // Action Handler
  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || !quote || !nonce) {
      toast.error("Please fill in all swap details")
      return
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    try {
      setIsSigning(true)
      toast.info("Please sign the intent in your wallet...")

      const { signature, intent, permit } = await createIntentSignature(
        tokenIn.address as `0x${string}`,
        tokenOut.address as `0x${string}`,
        amountIn,
        quote.output, // minAmountOut
        nonce,
        tokenIn.decimals,
        tokenOut.decimals,
        deadlineMinutes
      )

      // Log the signature that will be passed to the API
      console.log("=== Signature to be sent to API ===")
      console.log("Signature:", signature)
      console.log("===================================")

      // Serialize bigint values to strings for JSON
      const serializedIntent = {
        ...intent,
        inputAmt: intent.inputAmt.toString(),
        userAmtOut: intent.userAmtOut.toString(),
        deadline: intent.deadline.toString(),
        nonce: intent.nonce.toString(),
      }

      const serializedPermit = {
        ...permit,
        permitted: {
          ...permit.permitted,
          amount: permit.permitted.amount.toString(),
        },
        nonce: permit.nonce.toString(),
        deadline: permit.deadline.toString(),
      }

      // Log the full payload being sent to the API
      const apiPayload = {
        signature,
        intent: serializedIntent,
        permit: serializedPermit,
      }
      console.log("=== Full API Payload ===")
      console.log(JSON.stringify(apiPayload, null, 2))
      console.log("=========================")

      const response = await fetch("/api/relay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success("Swap Intent submitted to relayer!")
        setAmountIn("")
        refetchNonce() // Refresh nonce for next swap
      } else {
        toast.error(data.message || "Swap failed")
      }
    } catch (err: any) {
      if (err?.message?.includes("User rejected")) {
        toast.error("Signature rejected")
      } else {
        toast.error("Swap failed or was rejected")
      }
      console.error("Swap error:", err)
    } finally {
      setIsSigning(false)
    }
  }

  const switchTokens = () => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmountIn("")
  }

  // Format balance safely
  const formattedBalance = useMemo(() => {
    const num = parseFloat(balance)
    if (isNaN(num) || num === 0) return "0"
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }, [balance])

  return (
    <div className="w-full max-w-[440px] mx-auto">
      <Card className="relative p-0 bg-card/95 backdrop-blur-xl border-border/40 shadow-lg rounded-3xl overflow-hidden">
        
        {/* Top Navigation / Header */}
        <div className="flex justify-between items-center px-5 pt-4 pb-1">
          <span className="text-xs font-medium text-muted-foreground tracking-tight">Swap</span>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-7 w-7 hover:bg-muted/40 transition-colors"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings2 size={16} className="text-muted-foreground" />
          </Button>
        </div>

        <div className="px-4 pb-2 space-y-0">
          {/* Input Module: Minimal Google Style */}
          <div className="group relative p-4 bg-muted/20 rounded-2xl border border-border/20 focus-within:border-border/40 transition-all duration-200">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-muted-foreground">Sell</label>
              {address && tokenIn && (
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] text-muted-foreground/80 tabular-nums">Balance: {formattedBalance}</span>
                  <button 
                    onClick={() => setAmountIn(balance)}
                    className="text-[10px] font-semibold text-foreground/80 hover:text-foreground uppercase tracking-wider transition-colors"
                  >
                    Max
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                className="flex-1 text-3xl font-light tracking-tight border-0 bg-transparent focus-visible:ring-0 p-0 h-auto placeholder:text-muted-foreground/20 text-foreground"
              />
              <Button
                variant="outline"
                onClick={() => setTokenSelectorOpen("in")}
                className="flex items-center gap-1.5 pr-2.5 pl-2 h-10 border-border/30 bg-background/80 hover:bg-background transition-all rounded-xl min-w-[100px]"
              >
                {tokenIn?.logoURI && <img src={tokenIn.logoURI} alt={tokenIn.symbol} className="w-5 h-5 rounded-full" />}
                <span className="font-medium text-xs text-foreground">{tokenIn?.symbol || "Select"}</span>
                <ChevronDown size={12} className="text-muted-foreground/50" />
              </Button>
            </div>
          </div>

          {/* Minimal Switcher */}
          <div className="relative h-1 flex justify-center items-center z-20 -my-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="absolute rounded-xl h-9 w-9 bg-card border-2 border-card shadow-md hover:scale-105 active:scale-95 transition-all group"
              onClick={switchTokens}
            >
              <ArrowUpDown size={16} className="text-foreground/60 group-hover:rotate-180 transition-transform duration-300" />
            </Button>
          </div>

          {/* Output Module */}
          <div className="p-4 bg-muted/10 rounded-2xl border border-border/15 transition-all duration-200">
            <div className="flex justify-between items-center mb-2 text-xs font-medium text-muted-foreground">
              <span>Buy</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-3xl font-light tracking-tight text-foreground/80 tabular-nums overflow-hidden text-ellipsis">
                {quote?.output || "0"}
              </div>
              <Button
                variant="outline"
                onClick={() => setTokenSelectorOpen("out")}
                className="flex items-center gap-1.5 pr-2.5 pl-2 h-10 border-border/30 bg-background/80 hover:bg-background transition-all rounded-xl min-w-[100px]"
              >
                {tokenOut?.logoURI && <img src={tokenOut.logoURI} alt={tokenOut.symbol} className="w-5 h-5 rounded-full" />}
                <span className="font-medium text-xs text-foreground">{tokenOut?.symbol || "Select"}</span>
                <ChevronDown size={12} className="text-muted-foreground/50" />
              </Button>
            </div>
          </div>
        </div>

        {/* Info & Quote Section - More Compact */}
        <div className="px-5 py-3">
          <SwapQuoter
            quote={quote}
            timeLeft={timeLeft}
            isRefreshing={isRefreshing}
            tokenInSymbol={tokenIn?.symbol}
            tokenOutSymbol={tokenOut?.symbol}
          />
        </div>

        {/* Main Action: Minimal Google Button */}
        <div className="px-4 pb-4">
          <Button
            className={cn(
              "w-full h-12 rounded-xl text-sm font-medium transition-all duration-200",
              "bg-foreground text-background shadow-sm",
              "hover:bg-foreground/90 hover:shadow-md",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
            )}
            disabled={!amountIn || isRefreshing || isSigning || isLoading || !quote}
            onClick={handleSwap}
          >
            {isSigning ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                <span>Signing...</span>
              </div>
            ) : isLoading ? (
              "Loading..."
            ) : (
              "Review Swap"
            )}
          </Button>
        </div>
      </Card>

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="rounded-[32px] border-border/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">Settings</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Configure how your intent is executed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground ml-1">Signature Deadline</Label>
              <div className="flex flex-wrap gap-2">
                {DEADLINE_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    variant={deadlineMinutes === p.value ? "default" : "secondary"}
                    className="rounded-2xl px-5 h-10 transition-all"
                    onClick={() => setDeadlineMinutes(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-3 bg-muted/30 border border-border/30 rounded-xl flex gap-2.5 items-start">
              <Info size={16} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Short deadlines protect you from market volatility. We recommend 30 minutes for the best balance of security and execution reliability.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <TokenSelector
        open={tokenSelectorOpen === "in"}
        onOpenChange={(open) => setTokenSelectorOpen(open ? "in" : null)}
        tokens={tokens}
        selectedToken={tokenIn}
        onSelect={(token) => {
          setTokenIn(token)
          setTokenSelectorOpen(null)
        }}
      />
      <TokenSelector
        open={tokenSelectorOpen === "out"}
        onOpenChange={(open) => setTokenSelectorOpen(open ? "out" : null)}
        tokens={tokens}
        selectedToken={tokenOut}
        onSelect={(token) => {
          setTokenOut(token)
          setTokenSelectorOpen(null)
        }}
      />
    </div>
  )
}
