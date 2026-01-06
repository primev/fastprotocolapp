"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { TrendingUp, ArrowUpRight, Coins } from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { DEFAULT_ETH_PRICE_USD } from "@/lib/constants"
import { FEATURE_FLAGS } from "@/lib/feature-flags"

interface UserMetricsSectionProps {
  address?: string
  initialGlobalStats?: {
    totalTxs: number | null
    swapTxs: number | null
    totalSwapVolEth: number | null
    ethPrice: number | null
  } | null
}

interface UserMetrics {
  totalTxs: number
  swapTxs: number
  totalSwapVolEth: number
  ethPrice: number | null
}

export const UserMetricsSection = ({
  address,
  initialGlobalStats,
}: UserMetricsSectionProps) => {
  const [metrics, setMetrics] = useState<UserMetrics | null>(
    // If initial global stats are provided, use them
    initialGlobalStats
      ? {
          totalTxs: initialGlobalStats.totalTxs ?? 0,
          swapTxs: initialGlobalStats.swapTxs ?? 0,
          totalSwapVolEth: initialGlobalStats.totalSwapVolEth ?? 0,
          ethPrice: initialGlobalStats.ethPrice ?? null,
        }
      : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If initial global stats are provided, don't fetch
    if (initialGlobalStats && FEATURE_FLAGS.show_global_stats) {
      return
    }

    const fetchMetrics = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // If feature flag is enabled, fetch global stats (same endpoints as claim page)
        if (FEATURE_FLAGS.show_global_stats) {
          const [transactionsResponse, swapVolumeResponse, swapCountResponse, ethPriceResponse] =
            await Promise.all([
              fetch("/api/analytics/transactions"),
              fetch("/api/analytics/volume/swap"),
              fetch("/api/analytics/swap-count"),
              fetch("/api/analytics/eth-price"),
            ])

          if (!transactionsResponse.ok || !swapVolumeResponse.ok) {
            throw new Error("Failed to fetch global metrics")
          }

          const transactionsData = await transactionsResponse.json()
          const swapVolumeData = await swapVolumeResponse.json()
          const swapCountData = swapCountResponse.ok ? await swapCountResponse.json() : null
          const ethPriceData = ethPriceResponse.ok ? await ethPriceResponse.json() : null

          setMetrics({
            totalTxs: transactionsData.cumulativeSuccessfulTxs || 0,
            swapTxs: swapCountData?.swapTxCount || 0,
            totalSwapVolEth: swapVolumeData.cumulativeSwapVolEth || 0,
            ethPrice:
              ethPriceData?.ethPrice !== null && ethPriceData?.ethPrice !== undefined
                ? Number(ethPriceData.ethPrice)
                : null,
          })
        } else {
          // Fetch user-specific data
          if (!address) {
            setMetrics(null)
            return
          }

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
        }
      } catch (err) {
        console.error("Error fetching metrics:", err)
        setError("Failed to load metrics")
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetrics()
  }, [address])

  // Show placeholder data when not logged in (only for user-specific stats)
  const showPlaceholder = !FEATURE_FLAGS.show_global_stats && !address
  const displayMetrics = showPlaceholder
    ? { totalTxs: 0, swapTxs: 0, totalSwapVolEth: 0, ethPrice: null }
    : metrics

  const isGlobalStats = FEATURE_FLAGS.show_global_stats

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">
          {isGlobalStats ? "Global Transaction Summary" : "Transaction Summary"}
        </h2>
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
              {!isGlobalStats && (
                <div className="text-sm text-muted-foreground">All Fast RPC transactions</div>
              )}
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
              {!isGlobalStats && (
                <div className="text-sm text-muted-foreground">Total swaps with Fast RPC</div>
              )}
            </div>
          </Card>

          {/* Swap Volume */}
          <Card className="p-6 bg-card/50 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Swap Volume</h3>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold font-mono">
                {(() => {
                  const swapVolume = displayMetrics.totalSwapVolEth
                  const price =
                    displayMetrics.ethPrice !== null
                      ? displayMetrics.ethPrice
                      : DEFAULT_ETH_PRICE_USD
                  const totalUsd = swapVolume * price
                  return `$${totalUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                    notation: "compact",
                    compactDisplay: "short",
                  })}`
                })()}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
