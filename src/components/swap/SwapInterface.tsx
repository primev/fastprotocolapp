"use client"

import React, { useState } from "react"
import { ArrowDown, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import AmountInput from "./AmountInput"
import TokenSelector from "./TokenSelector"
import SwapQuoter from "./SwapQuoter"
import { useSwapQuote } from "@/hooks/use-swap-quote"
import { useSwapIntent } from "@/hooks/use-swap-intent"
import { usePermit2Nonce } from "@/hooks/use-permit2-nonce"
import type { Token } from "@/types/swap"

interface SwapInterfaceProps {
  tokens: Token[]
  isLoading?: boolean
}

export default function SwapInterface({ tokens, isLoading = false }: SwapInterfaceProps) {
  const { createIntentSignature } = useSwapIntent()
  const { nonce, refetchNonce } = usePermit2Nonce()

  // 1. Selection State
  const [tokenIn, setTokenIn] = useState<Token | undefined>(tokens?.[0])
  const [tokenOut, setTokenOut] = useState<Token | undefined>(tokens?.[1])

  // Update tokens when they change
  React.useEffect(() => {
    if (tokens.length > 0 && !tokenIn) {
      setTokenIn(tokens[0])
    }
    if (tokens.length > 1 && !tokenOut) {
      setTokenOut(tokens[1])
    }
  }, [tokens, tokenIn, tokenOut])
  const [amountIn, setAmountIn] = useState("")
  const [isSigning, setIsSigning] = useState(false)

  // 2. Quote Logic
  const { quote, timeLeft, isRefreshing } = useSwapQuote({
    tokenIn,
    tokenOut,
    amountIn,
  })

  // 3. Action Handler
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
        tokenOut.decimals
      )

      // 4. Send to Backend Relayer
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

      const response = await fetch("/api/relay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature,
          intent: serializedIntent,
          permit: serializedPermit,
        }),
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

  const isSwapDisabled = !amountIn || isRefreshing || isLoading || isSigning || !quote

  return (
    <Card className="w-full max-w-[480px] p-4 bg-background/60 backdrop-blur-xl border-white/10 shadow-2xl mx-auto">
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-xl font-bold tracking-tight">Swap</h2>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Settings2 size={18} />
        </Button>
      </div>

      <div className="space-y-1 relative">
        {/* Sell Section */}
        <AmountInput
          label="Sell"
          value={amountIn}
          onChange={setAmountIn}
          selectedToken={tokenIn}
          onTokenSelect={setTokenIn}
          tokens={tokens}
        />

        {/* Switch Button */}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <Button
            size="icon"
            variant="secondary"
            className="rounded-xl border-4 border-background h-10 w-10 hover:scale-110 transition-transform"
            onClick={switchTokens}
          >
            <ArrowDown size={16} />
          </Button>
        </div>

        {/* Buy Section */}
        <AmountInput
          label="Buy"
          value={quote?.output || ""}
          readOnly
          selectedToken={tokenOut}
          onTokenSelect={setTokenOut}
          tokens={tokens}
        />
      </div>

      {/* Pricing & Logic Details */}
      <div className="mt-4">
        <SwapQuoter
          quote={quote}
          timeLeft={timeLeft}
          isRefreshing={isRefreshing}
          tokenInSymbol={tokenIn?.symbol}
          tokenOutSymbol={tokenOut?.symbol}
        />
      </div>

      {/* Main Action */}
      <Button
        className="w-full mt-4 h-14 text-lg font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
        disabled={isSwapDisabled}
        onClick={handleSwap}
      >
        {isLoading ? "Loading Tokens..." : isSigning ? "Signing..." : "Swap"}
      </Button>
    </Card>
  )
}
