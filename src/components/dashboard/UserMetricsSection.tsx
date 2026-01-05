"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { TrendingUp, ArrowUpRight, Coins } from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { DEFAULT_ETH_PRICE_USD } from "@/lib/constants"

interface UserMetricsSectionProps {
  address?: string
}

interface UserMetrics {
  totalTxs: number
  swapTxs: number
  totalSwapVolEth: number
  ethPrice: number | null
}

export const UserMetricsSection = ({ address }: UserMetricsSectionProps) => {
  const [metrics, setMetrics] = useState<UserMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      setMetrics(null)
      return
    }

    const fetchMetrics = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/analytics/user/${address}`)

        if (!response.ok) {
          throw new Error("Failed to fetch user metrics")
        }

        const data = await response.json()
        setMetrics({
          totalTxs: data.totalTxs || 0,
          swapTxs: data.swapTxs || 0,
          totalSwapVolEth: data.totalSwapVolEth || 0,
          ethPrice:
            data.ethPrice !== null && data.ethPrice !== undefined ? Number(data.ethPrice) : null,
        })
      } catch (err) {
        console.error("Error fetching user metrics:", err)
        setError("Failed to load metrics")
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetrics()
  }, [address])

  // Show placeholder data when not logged in
  const showPlaceholder = !address
  const displayMetrics = showPlaceholder
    ? { totalTxs: 0, swapTxs: 0, totalSwapVolEth: 0, ethPrice: null }
    : metrics

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Transaction Summary</h2>
        {/* <p className="text-muted-foreground">Track your transaction metrics and swap volume</p> */}
      </div>

      {isLoading && !showPlaceholder && (
        <Card className="p-6 bg-card/50 border-border/50">
          <div className="text-center text-muted-foreground">Loading metrics...</div>
        </Card>
      )}

      {error && !showPlaceholder && (
        <Card className="p-6 bg-card/50 border-border/50">
          <div className="text-center text-destructive">{error}</div>
        </Card>
      )}

      {!isLoading && !error && displayMetrics && (
        <div className={`grid md:grid-cols-3 gap-6 ${showPlaceholder ? "blur-sm" : ""}`}>
          {/* Total Transactions */}
          <Card className="p-6 bg-card/50 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Total Transactions</h3>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold font-mono">
                {formatNumber(displayMetrics.totalTxs)}
              </div>
              <div className="text-sm text-muted-foreground">All Fast RPC transactions</div>
            </div>
          </Card>

          {/* Swap Transactions */}
          <Card className="p-6 bg-card/50 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Swap Transactions</h3>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold font-mono">
                {formatNumber(displayMetrics.swapTxs)}
              </div>
              <div className="text-sm text-muted-foreground">Total swaps with Fast RPC</div>
            </div>
          </Card>

          {/* Swap Volume */}
          <Card className="p-6 bg-card/50 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Swap Volume</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2 text-3xl font-bold font-mono">
                {(() => {
                  const price =
                    displayMetrics.ethPrice !== null
                      ? displayMetrics.ethPrice
                      : DEFAULT_ETH_PRICE_USD
                  const totalUsd = displayMetrics.totalSwapVolEth * price
                  // If the value has decimals, show 2 decimal places, otherwise use compact notation
                  if (totalUsd % 1 !== 0) {
                    return `$${totalUsd.toFixed(2)}`
                  }
                  return `$${formatNumber(totalUsd, {
                    maximumFractionDigits: 1,
                  })}`
                })()}
                <span className="text-base text-muted-foreground font-normal ml-1">USD</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-mono">
                  {formatNumber(displayMetrics.totalSwapVolEth, { maximumFractionDigits: 4 })}
                </span>{" "}
                ETH
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
