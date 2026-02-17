"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ChevronDown, ArrowDown, Wallet } from "lucide-react"
import { useAccount, useBalance } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { formatUnits } from "viem"
import { cn, formatCurrency } from "@/lib/utils"
import TokenSelector from "./TokenSelector"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import tokenList from "@/lib/token-list.json"
import type { Token } from "@/types/swap"

// Stablecoin symbols (2 decimals)
const STABLECOIN_SYMBOLS = ["USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX", "USDP", "LUSD"]

// Major asset symbols (4-6 decimals)
const MAJOR_ASSET_SYMBOLS = ["ETH", "WBTC", "BTC"]

/**
 * Smart formatter for display amounts
 * Handles different token types with appropriate decimal precision
 */
const formatDisplayAmount = (amount: string | number, token?: Token): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  
  if (isNaN(num) || num === 0) return "0"
  
  const symbol = token?.symbol?.toUpperCase() || ""
  
  // Stablecoins: 2 decimals
  if (STABLECOIN_SYMBOLS.includes(symbol)) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num)
  }
  
  // Very small numbers (< 0.001): use significant digits
  if (num < 0.001) {
    return num.toLocaleString('en-US', { 
      maximumSignificantDigits: 6,
      notation: 'standard'
    })
  }
  
  // Major assets: 4-6 decimals based on value
  if (MAJOR_ASSET_SYMBOLS.includes(symbol)) {
    // For values >= 1, show 4 decimals. For < 1, show 6 decimals
    const decimals = num >= 1 ? 4 : 6
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    }).format(num)
  }
  
  // Default: 4-6 decimals based on value
  const decimals = num >= 1 ? 4 : 6
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(num)
}

/**
 * Formats amount with visual contrast (graying trailing digits)
 */
const formatAmountWithContrast = (amount: string, token?: Token): React.ReactNode => {
  const formatted = formatDisplayAmount(amount, token)
  const num = parseFloat(amount)
  
  if (isNaN(num) || num === 0) return "0"
  
  // For very precise numbers, show trailing digits in gray
  const fullStr = num.toString()
  const formattedStr = formatted.replace(/,/g, '')
  
  // If the formatted string is shorter, show trailing digits in gray
  if (fullStr.length > formattedStr.length && num < 1) {
    const matchIndex = formattedStr.length
    const significantPart = formattedStr
    const trailingPart = fullStr.substring(matchIndex)
    
    // Only show gray if there are meaningful trailing digits
    if (trailingPart.length > 0 && trailingPart !== '0') {
      return (
        <>
          {significantPart}
          <span className="text-white/20">{trailingPart.substring(0, 4)}</span>
        </>
      )
    }
  }
  
  return formatted
}

// Default ETH token for when wallet is not connected
const DEFAULT_ETH_TOKEN: Token = {
  address: "0x0000000000000000000000000000000000000000",
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
  logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
}

export default function SwapInterface() {
  const { isConnected, address } = useAccount()
  const { openConnectModal } = useConnectModal()
  
  // Use token list from JSON file
  const tokens = (tokenList as Token[])
  
  const [amount, setAmount] = useState("")
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [fromToken, setFromToken] = useState<Token | undefined>(DEFAULT_ETH_TOKEN)
  const [toToken, setToToken] = useState<Token | undefined>(undefined)
  const [isFromTokenSelectorOpen, setIsFromTokenSelectorOpen] = useState(false)
  const [isToTokenSelectorOpen, setIsToTokenSelectorOpen] = useState(false)
  const [tokenPrice, setTokenPrice] = useState<number | null>(null)
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)

  // Default to ETH when wallet is not connected or when tokens load
  useEffect(() => {
    if (!isConnected) {
      // When wallet is not connected, always default to ETH
      const ethToken = tokens.find(t => t.symbol === "ETH") || DEFAULT_ETH_TOKEN
      setFromToken(ethToken)
    } else if (tokens.length > 0 && !fromToken) {
      // When wallet connects and tokens are loaded, default to ETH if no token selected
      const ethToken = tokens.find(t => t.symbol === "ETH") || DEFAULT_ETH_TOKEN
      setFromToken(ethToken)
    }
  }, [isConnected, tokens, fromToken])

  // Fetch token price when fromToken changes
  useEffect(() => {
    if (!fromToken?.symbol) {
      setTokenPrice(null)
      return
    }

    setIsLoadingPrice(true)
    fetch(`/api/token-price?symbol=${encodeURIComponent(fromToken.symbol)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.price) {
          setTokenPrice(data.price)
        } else {
          setTokenPrice(null)
        }
      })
      .catch((error) => {
        console.error("Error fetching token price:", error)
        setTokenPrice(null)
      })
      .finally(() => {
        setIsLoadingPrice(false)
      })
  }, [fromToken])

  // Fetch balance for native ETH or ERC20 token
  const { data: balance, isLoading: isLoadingBalance } = useBalance({
    address: isConnected && address ? address : undefined,
    token: fromToken?.address && fromToken.address !== "0x0000000000000000000000000000000000000000" 
      ? fromToken.address as `0x${string}` 
      : undefined,
    query: {
      enabled: isConnected && !!address && !!fromToken,
    },
  })

  // Format balance for display using smart formatter
  const balanceValue = balance && fromToken
    ? parseFloat(formatUnits(balance.value, fromToken.decimals))
    : 0
  const formattedBalance = balanceValue > 0 
    ? formatDisplayAmount(balanceValue, fromToken)
    : "0"

  // Common tokens for quick select: ETH, USDC, USDT, WBTC, WETH
  const commonTokens = useMemo(() => {
    const symbols = ["ETH", "USDC", "USDT", "WBTC", "WETH"]
    const foundTokens: Token[] = []
    
    // Always start with ETH (DEFAULT_ETH_TOKEN) if it's not the from token
    if (!fromToken || fromToken.symbol.toUpperCase() !== "ETH") {
      const ethToken = tokens.find(t => t.symbol.toUpperCase() === "ETH") || DEFAULT_ETH_TOKEN
      foundTokens.push(ethToken)
    }
    
    // Add other tokens in order
    symbols.forEach(symbol => {
      if (symbol.toUpperCase() === "ETH") return // Already added above
      
      const token = tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase())
      
      // Only add if token exists and is not the from token
      if (token && token.address !== fromToken?.address) {
        foundTokens.push(token)
      }
    })
    
    return foundTokens
  }, [tokens, fromToken])

  return (
    <div className="w-full max-w-[500px] bg-[#131313] border border-white/10 rounded-[24px] p-2 flex flex-col gap-1 shadow-2xl relative z-0">
      
      {/* SELL SECTION */}
      <div className="group bg-[#1B1B1B] rounded-[20px] p-4 flex flex-col gap-2 border border-transparent focus-within:border-white/5 transition-all">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sell</span>
          {/* Quick Select Percentages - Only visible on hover */}
          {isConnected && balance && fromToken && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {['25%', '50%', '75%', 'Max'].map((pct) => {
                const handlePercentageClick = () => {
                  if (!balance || !fromToken) return
                  
                  const balanceValue = parseFloat(formatUnits(balance.value, fromToken.decimals))
                  
                  if (pct === 'Max') {
                    setAmount(balanceValue.toString())
                  } else {
                    const percent = parseFloat(pct) / 100
                    const amountValue = balanceValue * percent
                    setAmount(amountValue.toString())
                  }
                }
                
                return (
                  <button 
                    key={pct}
                    onClick={handlePercentageClick}
                    className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-bold text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {pct}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-1">
          {(() => {
            const displayValue = isInputFocused || !amount 
              ? amount 
              : formatDisplayAmount(amount, fromToken)
            const fullValue = amount && parseFloat(amount) > 0 
              ? parseFloat(amount).toString()
              : null
            const isTrimmed = fullValue && displayValue !== fullValue
            
            if (isTrimmed) {
              return (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          value={displayValue}
                          onChange={(e) => {
                            // Allow user to type freely, store raw value
                            const value = e.target.value.replace(/[^0-9.]/g, '')
                            // Prevent multiple decimal points
                            const parts = value.split('.')
                            const cleaned = parts.length > 2 
                              ? parts[0] + '.' + parts.slice(1).join('')
                              : value
                            setAmount(cleaned)
                          }}
                          onFocus={() => setIsInputFocused(true)}
                          onBlur={() => {
                            setIsInputFocused(false)
                            // Format on blur if needed
                            if (amount) {
                              const num = parseFloat(amount)
                              if (!isNaN(num)) {
                                setAmount(num.toString())
                              }
                            }
                          }}
                          placeholder="0"
                          className="bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20"
                          disabled={!isConnected}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs font-mono bg-zinc-900 border-zinc-700">
                      <p className="text-white/70">{parseFloat(amount).toLocaleString('en-US', { 
                        maximumFractionDigits: 18,
                        useGrouping: false
                      })}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }
            
            return (
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={displayValue}
                  onChange={(e) => {
                    // Allow user to type freely, store raw value
                    const value = e.target.value.replace(/[^0-9.]/g, '')
                    // Prevent multiple decimal points
                    const parts = value.split('.')
                    const cleaned = parts.length > 2 
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : value
                    setAmount(cleaned)
                  }}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => {
                    setIsInputFocused(false)
                    // Format on blur if needed
                    if (amount) {
                      const num = parseFloat(amount)
                      if (!isNaN(num)) {
                        setAmount(num.toString())
                      }
                    }
                  }}
                  placeholder="0"
                  className="bg-transparent text-4xl font-medium outline-none w-full placeholder:text-white/20"
                  disabled={!isConnected}
                />
              </div>
            )
          })()}
          <button 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsFromTokenSelectorOpen(true)
            }}
            className="flex items-center gap-2 bg-[#131313] hover:bg-[#222] border border-white/10 rounded-full pl-1 pr-3 py-1 shadow-sm transition-all"
          >
            {fromToken ? (
              <>
                {fromToken.logoURI ? (
                  <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center">
                    <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                    <span className="text-xs font-bold">{fromToken.symbol[0]}</span>
                  </div>
                )}
                <span className="font-bold text-lg">{fromToken.symbol}</span>
              </>
            ) : (
              <span className="font-bold text-lg">Select</span>
            )}
            <ChevronDown size={16} className="text-white/40" />
          </button>
        </div>

        <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
          <span>
            {amount && parseFloat(amount) > 0 && tokenPrice
              ? (() => {
                  const usdValue = parseFloat(amount) * tokenPrice
                  return `$${usdValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: true
                  })}`
                })()
              : amount && parseFloat(amount) > 0 && isLoadingPrice
              ? "—"
              : "—"}
          </span>
          {isConnected && address && fromToken && balance && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <Wallet size={12} className="opacity-40" />
                    <span>
                      {isLoadingBalance ? "—" : `${formattedBalance} ${fromToken.symbol}`}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-mono bg-zinc-900 border-zinc-700">
                  <p className="text-white/90">Full balance:</p>
                  <p className="text-white/70">
                    {balanceValue.toLocaleString('en-US', { 
                      maximumFractionDigits: 18,
                      useGrouping: false
                    })} {fromToken.symbol}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* SWITCH BUTTON (Centered) */}
      <div className="relative h-2 w-full flex justify-center z-20">
        <button 
          onClick={() => {
            const temp = fromToken
            setFromToken(toToken)
            setToToken(temp)
            setAmount("")
          }}
          className="absolute -top-4 p-2 bg-[#1B1B1B] border-[4px] border-[#131313] rounded-xl hover:scale-110 transition-transform text-white shadow-lg"
        >
          <ArrowDown size={18} strokeWidth={3} />
        </button>
      </div>

      {/* BUY SECTION */}
      <div className="group relative bg-[#1B1B1B] rounded-[20px] p-4 flex flex-col gap-2 border border-transparent hover:bg-[#1e1e1e] transition-all">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Buy</span>
          {/* Common Tokens Quick Select - Only visible on hover */}
          {commonTokens.length > 0 && (
            <TooltipProvider delayDuration={0}>
              <div className="flex gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
                {commonTokens.map((token) => (
                  <Tooltip key={token.address}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setToToken(token)}
                        className="p-1 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                      >
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-5 h-5 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold">{token.symbol[0]}</span>
                          </div>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{token.symbol}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          )}
        </div>

        <div className="flex justify-between items-center mt-1">
          <span className="text-4xl font-medium text-white/40">0</span>
          <button 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsToTokenSelectorOpen(true)
            }}
            className="flex items-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-full px-3 py-1.5 shadow-lg transition-all"
          >
            {toToken ? (
              <>
                {toToken.logoURI && (
                  <div className="w-4 h-4 rounded-full overflow-hidden">
                    <img src={toToken.logoURI} alt={toToken.symbol} className="w-full h-full object-contain" />
                  </div>
                )}
                <span className="font-bold text-sm">{toToken.symbol}</span>
              </>
            ) : (
              <span className="font-bold text-sm">Select token</span>
            )}
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="h-4" /> {/* Spacer to match height */}
      </div>

      {/* ACTION BUTTON */}
      <button
        className="mt-1 w-full py-4 rounded-[20px] bg-primary/10 text-primary hover:bg-primary/20 font-bold text-lg transition-all"
      >
        Get Started
      </button>

      {/* Token Selectors */}
      <TokenSelector
        open={isFromTokenSelectorOpen}
        onOpenChange={setIsFromTokenSelectorOpen}
        tokens={tokens.length > 0 ? tokens : [DEFAULT_ETH_TOKEN]}
        selectedToken={fromToken}
        onSelect={setFromToken}
      />
      <TokenSelector
        open={isToTokenSelectorOpen}
        onOpenChange={setIsToTokenSelectorOpen}
        tokens={tokens.length > 0 
          ? tokens.filter(t => t.address !== fromToken?.address)
          : [DEFAULT_ETH_TOKEN]}
        selectedToken={toToken}
        onSelect={setToToken}
      />
    </div>
  )
}