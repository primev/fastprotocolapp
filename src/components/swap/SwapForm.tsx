"use client"

import { useState } from "react"
import { ArrowDownUp, Loader2, Wallet } from "lucide-react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const ETH_ICON = (
  <svg
    className="h-5 w-5 sm:h-5 sm:w-5 fill-current"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 320 512"
  >
    <path d="M311.9 260.8L160 353.6 8 260.8 160 0l151.9 260.8zM160 383.4L8 290.6 160 512l152-221.4-152 92.8z" />
  </svg>
)

const FAST_ICON = (
  <svg
    className="h-5 w-5 sm:h-5 sm:w-5"
    viewBox="0 0 98 95"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0.344727 0.226562L36.7147 94.6165H59.9647L26.0747 0.226562H0.344727Z"
      className="fill-primary"
    />
    <path
      d="M72.8246 0.226562L52.5447 56.5766H76.2947L97.8146 0.226562H72.8246Z"
      fill="#E97D25"
    />
  </svg>
)

interface TokenSelectorProps {
  token: "ETH" | "FAST"
  balance: string
  className?: string
}

function TokenSelector({ token, balance, className }: TokenSelectorProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg bg-muted/50 p-2.5 sm:p-3",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-background">
          {token === "ETH" ? ETH_ICON : FAST_ICON}
        </div>
        <span className="font-semibold text-sm sm:text-base">{token}</span>
      </div>
      <span className="text-xs sm:text-sm text-muted-foreground">Balance: {balance}</span>
    </div>
  )
}

function truncateAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function SwapForm() {
  const { address, isConnected } = useAccount()
  const [fromAmount, setFromAmount] = useState("")
  const [isSwapping, setIsSwapping] = useState(false)
  const [fromToken, setFromToken] = useState<"ETH" | "FAST">("ETH")
  const toToken = fromToken === "ETH" ? "FAST" : "ETH"

  // Mock exchange rate
  const exchangeRate = fromToken === "ETH" ? 1000 : 0.001
  const toAmount = fromAmount ? (parseFloat(fromAmount) * exchangeRate).toFixed(6) : "0"

  const handleSwapTokens = () => {
    setFromToken(fromToken === "ETH" ? "FAST" : "ETH")
    setFromAmount("")
  }

  const handleSwap = async () => {
    if (!fromAmount || !isConnected) return
    setIsSwapping(true)
    // Simulated swap delay
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsSwapping(false)
    setFromAmount("")
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-0">
      {/* Gradient Card Container */}
      <div className="rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-accent/20 p-[1px] shadow-xl">
        <div className="rounded-2xl bg-card/95 backdrop-blur-xl">
          {/* Header Section */}
          <div className="space-y-3 sm:space-y-4 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold">Fast Swap</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Lightning-fast token swaps
                </p>
              </div>

              {isConnected && address ? (
                <div className="flex items-center sm:flex-col sm:items-end gap-2 sm:gap-2">
                  <div className="flex items-center gap-2 rounded-full bg-muted/50 px-2.5 sm:px-3 py-1 sm:py-1.5">
                    <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                    <span className="text-xs sm:text-sm">{truncateAddress(address)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Connected</span>
                  </div>
                </div>
              ) : (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openConnectModal}
                      className="rounded-full text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
                    >
                      Connect Wallet
                    </Button>
                  )}
                </ConnectButton.Custom>
              )}
            </div>
          </div>

          {/* Swap Form Section */}
          <div className="space-y-3 sm:space-y-4 rounded-b-2xl bg-background/50 p-4 sm:p-6">
            {/* From Token */}
            <div className="space-y-2">
              <label className="text-xs sm:text-sm text-muted-foreground">From</label>
              <TokenSelector
                token={fromToken}
                balance={fromToken === "ETH" ? "0.00" : "0.00"}
              />
              <div className="relative">
                <Input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-12 sm:h-14 border-border/50 bg-muted/30 pl-3 sm:pl-4 pr-14 sm:pr-16 text-base sm:text-lg font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1.5 sm:right-2 top-1/2 h-7 sm:h-8 -translate-y-1/2 text-xs text-primary hover:text-primary px-2 sm:px-3"
                  onClick={() => setFromAmount("0")}
                >
                  MAX
                </Button>
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center -my-1 sm:my-0">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border-primary/30 bg-card hover:bg-primary/10 active:scale-95 transition-transform"
                onClick={handleSwapTokens}
              >
                <ArrowDownUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </Button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <label className="text-xs sm:text-sm text-muted-foreground">To</label>
              <TokenSelector
                token={toToken}
                balance={toToken === "ETH" ? "0.00" : "0.00"}
              />
              <div className="relative">
                <Input
                  type="text"
                  value={toAmount}
                  readOnly
                  placeholder="0.00"
                  className="h-12 sm:h-14 border-border/50 bg-muted/30 pl-3 sm:pl-4 text-base sm:text-lg font-medium text-muted-foreground"
                />
              </div>
            </div>

            {/* Swap Button */}
            <Button
              className="w-full h-11 sm:h-12 rounded-xl font-semibold text-sm sm:text-base active:scale-[0.98] transition-transform"
              disabled={!fromAmount || !isConnected || isSwapping}
              onClick={handleSwap}
            >
              {!isConnected ? (
                "Connect Wallet"
              ) : isSwapping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Swapping...
                </>
              ) : (
                "Swap"
              )}
            </Button>

            {/* Details Section */}
            <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange Rate</span>
                <span className="text-right">
                  1 {fromToken} = {exchangeRate.toLocaleString()} {toToken}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="text-muted-foreground">~$0.00</span>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">You Receive</span>
                <span className="text-right">
                  {toAmount} <span className="text-muted-foreground">{toToken}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="mt-3 sm:mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Swap functionality coming soon. Connect your wallet to be ready for launch.
        </p>
      </div>
    </div>
  )
}
