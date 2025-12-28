"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowDown, ChevronDown, Loader2, Settings, Info } from "lucide-react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Token Icons
const ETH_ICON = (
  <svg className="h-6 w-6 fill-current" viewBox="0 0 320 512">
    <path d="M311.9 260.8L160 353.6 8 260.8 160 0l151.9 260.8zM160 383.4L8 290.6 160 512l152-221.4-152 92.8z" />
  </svg>
)

const FAST_ICON = (
  <svg className="h-6 w-6" viewBox="0 0 98 95" fill="none">
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

const USDC_ICON = (
  <svg className="h-6 w-6" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#2775CA" />
    <path
      d="M20.5 18.5c0-2-1.5-2.75-4.5-3.25-2-.5-2.5-1-2.5-2s1-1.75 2.5-1.75c1.5 0 2.25.5 2.5 1.5h2c-.25-1.75-1.5-3-3.5-3.25V8h-2v1.75c-2 .25-3.5 1.5-3.5 3.5 0 2 1.5 2.75 4.5 3.25 2 .5 2.5 1 2.5 2s-1 1.75-2.5 1.75c-1.75 0-2.5-.75-2.75-1.75h-2c.25 2 1.75 3.25 3.75 3.5V24h2v-1.75c2-.25 3.5-1.5 3.5-3.75z"
      fill="white"
    />
  </svg>
)

type TokenType = "ETH" | "FAST" | "USDC" | null

interface Token {
  symbol: string
  name: string
  icon: React.ReactNode
  balance: string
}

const TOKENS: Record<string, Token> = {
  ETH: { symbol: "ETH", name: "Ethereum", icon: ETH_ICON, balance: "0.00" },
  FAST: { symbol: "FAST", name: "Fast Token", icon: FAST_ICON, balance: "0.00" },
  USDC: { symbol: "USDC", name: "USD Coin", icon: USDC_ICON, balance: "0.00" },
}

interface TokenButtonProps {
  token: TokenType
  onClick: () => void
  showBalance?: boolean
}

function TokenButton({ token, onClick, showBalance }: TokenButtonProps) {
  if (!token) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-full bg-pink-500 hover:bg-pink-600 px-3 sm:px-4 py-1.5 sm:py-2 text-white font-semibold text-sm sm:text-base transition-colors active:scale-95"
      >
        Select token
        <ChevronDown className="h-4 w-4" />
      </button>
    )
  }

  const tokenData = TOKENS[token]
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 px-2.5 sm:px-3 py-1.5 sm:py-2 font-semibold text-sm sm:text-base transition-colors active:scale-95"
      >
        <div className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center">
          {tokenData.icon}
        </div>
        {tokenData.symbol}
        <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
      </button>
      {showBalance && (
        <span className="text-[10px] sm:text-xs text-muted-foreground pr-1">
          Balance: {tokenData.balance}
        </span>
      )}
    </div>
  )
}

// Animated Background Orbs
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Primary orb */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-primary/20 blur-3xl animate-pulse" />
      {/* Secondary orb */}
      <div className="absolute bottom-1/4 -right-20 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-pink-500/15 blur-3xl animate-pulse [animation-delay:1s]" />
      {/* Accent orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-72 sm:h-72 rounded-full bg-accent/10 blur-3xl animate-pulse [animation-delay:2s]" />
    </div>
  )
}

function truncateAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function SwapForm() {
  const { address, isConnected } = useAccount()
  const [sellAmount, setSellAmount] = useState("")
  const [buyAmount, setBuyAmount] = useState("")
  const [isSwapping, setIsSwapping] = useState(false)
  const [sellToken, setSellToken] = useState<TokenType>("ETH")
  const [buyToken, setBuyToken] = useState<TokenType>(null)
  const [slippage, setSlippage] = useState("0.5")
  const sellInputRef = useRef<HTMLInputElement>(null)

  // Mock exchange rate calculation
  const exchangeRate = sellToken === "ETH" && buyToken === "FAST" ? 1000 :
                       sellToken === "FAST" && buyToken === "ETH" ? 0.001 :
                       sellToken === "ETH" && buyToken === "USDC" ? 2300 :
                       sellToken === "USDC" && buyToken === "ETH" ? 0.000435 : 1

  // Update buy amount when sell amount changes
  useEffect(() => {
    if (sellAmount && sellToken && buyToken) {
      const calculated = (parseFloat(sellAmount) * exchangeRate).toFixed(6)
      setBuyAmount(calculated)
    } else {
      setBuyAmount("")
    }
  }, [sellAmount, sellToken, buyToken, exchangeRate])

  const handleSwapTokens = () => {
    const tempToken = sellToken
    const tempAmount = sellAmount
    setSellToken(buyToken)
    setBuyToken(tempToken)
    setSellAmount(buyAmount)
    setBuyAmount(tempAmount)
  }

  const handleSwap = async () => {
    if (!sellAmount || !isConnected || !buyToken) return
    setIsSwapping(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsSwapping(false)
    setSellAmount("")
    setBuyAmount("")
  }

  const handleTokenSelect = (type: "sell" | "buy", token: TokenType) => {
    if (type === "sell") {
      if (token === buyToken) setBuyToken(sellToken)
      setSellToken(token)
    } else {
      if (token === sellToken) setSellToken(buyToken)
      setBuyToken(token)
    }
  }

  const isSwapReady = sellAmount && sellToken && buyToken && isConnected
  const priceImpact = sellAmount ? "< 0.01%" : "-"

  return (
    <div className="relative min-h-[70vh] sm:min-h-[60vh] flex flex-col items-center justify-center px-4">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Hero Section */}
      <div className="relative z-10 text-center mb-6 sm:mb-8 max-w-xl">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
          Lightning-fast swaps
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
          Buy and sell crypto on Fast Protocol with the fastest execution and lowest fees.
        </p>
      </div>

      {/* Swap Card */}
      <div className="relative z-10 w-full max-w-[480px]">
        <div className="rounded-3xl bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/30">
            <span className="font-semibold text-base sm:text-lg">Swap</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Slippage: {slippage}%</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Swap Body */}
          <div className="p-4 sm:p-5 space-y-1">
            {/* Sell Section */}
            <div className="rounded-2xl bg-muted/30 border border-border/30 p-3 sm:p-4 transition-all focus-within:border-primary/50 focus-within:bg-muted/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm text-muted-foreground font-medium">Sell</span>
                {sellToken && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    Balance: {TOKENS[sellToken].balance}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Input
                  ref={sellInputRef}
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="0"
                  className="border-0 bg-transparent p-0 text-2xl sm:text-3xl md:text-4xl font-medium h-auto focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none flex-1 min-w-0"
                />
                <TokenButton
                  token={sellToken}
                  onClick={() => handleTokenSelect("sell", sellToken === "ETH" ? "FAST" : "ETH")}
                  showBalance={false}
                />
              </div>
              {sellAmount && sellToken && (
                <div className="mt-2 text-xs sm:text-sm text-muted-foreground">
                  ≈ ${sellToken === "ETH" ? (parseFloat(sellAmount) * 2300).toFixed(2) : (parseFloat(sellAmount) * 0.01).toFixed(2)}
                </div>
              )}
            </div>

            {/* Swap Arrow Button */}
            <div className="flex justify-center -my-3 sm:-my-4 relative z-10">
              <button
                onClick={handleSwapTokens}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-card border-4 border-background flex items-center justify-center hover:bg-muted transition-all active:scale-90 group shadow-lg"
              >
                <ArrowDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-hover:text-primary transition-colors group-hover:rotate-180 duration-300" />
              </button>
            </div>

            {/* Buy Section */}
            <div className="rounded-2xl bg-muted/30 border border-border/30 p-3 sm:p-4 transition-all focus-within:border-primary/50 focus-within:bg-muted/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm text-muted-foreground font-medium">Buy</span>
                {buyToken && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    Balance: {TOKENS[buyToken].balance}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Input
                  type="text"
                  value={buyAmount}
                  readOnly
                  placeholder="0"
                  className="border-0 bg-transparent p-0 text-2xl sm:text-3xl md:text-4xl font-medium h-auto focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0 text-muted-foreground"
                />
                <TokenButton
                  token={buyToken}
                  onClick={() => handleTokenSelect("buy", buyToken === "FAST" ? "USDC" : "FAST")}
                  showBalance={false}
                />
              </div>
              {buyAmount && buyToken && (
                <div className="mt-2 text-xs sm:text-sm text-muted-foreground">
                  ≈ ${buyToken === "ETH" ? (parseFloat(buyAmount) * 2300).toFixed(2) : (parseFloat(buyAmount) * 0.01).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* CTA Button */}
          <div className="p-4 sm:p-5 pt-0">
            {!isConnected ? (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <Button
                    onClick={openConnectModal}
                    className="w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
                  >
                    Connect Wallet
                  </Button>
                )}
              </ConnectButton.Custom>
            ) : !buyToken ? (
              <Button
                disabled
                className="w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg bg-muted text-muted-foreground"
              >
                Select a token
              </Button>
            ) : !sellAmount ? (
              <Button
                disabled
                className="w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg bg-muted text-muted-foreground"
              >
                Enter an amount
              </Button>
            ) : (
              <Button
                onClick={handleSwap}
                disabled={isSwapping}
                className="w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                {isSwapping ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Swapping...
                  </>
                ) : (
                  "Swap"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Exchange Rate Info */}
        {sellToken && buyToken && (
          <div className="mt-3 sm:mt-4 px-2">
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span>1 {sellToken} = {exchangeRate.toLocaleString()} {buyToken}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exchange rate may vary</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-3">
                <span>Price Impact: {priceImpact}</span>
              </div>
            </div>
          </div>
        )}

        {/* Network Badge */}
        <div className="mt-4 sm:mt-6 flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/30 text-xs sm:text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Fast Protocol Network
          </div>
        </div>
      </div>
    </div>
  )
}
