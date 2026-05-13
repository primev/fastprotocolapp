"use client"

import { useEffect, useState } from "react"

const DEFAULT_SURPLUS_RATE = 0.0056
/**
 * Mirrors `DEFAULT_BID_COST_ETH` in `/api/config/gas-estimate` and the
 * historically-hardcoded constant in `user-swaps-parts.tsx`. Used as the
 * cold-load fallback until the Edge Config fetch returns.
 */
const DEFAULT_BID_COST_ETH = 0.00004

export type MilesEstimateConfig = {
  /** p25 of `surplus / user_amt_out` over 30 days, from Edge Config. */
  surplusRate: number
  /**
   * p75 of realized `bid_cost / 1e18` since 2026-04-08, from Edge Config.
   * Proxies the NULL `bid_cost` on pending dashboard rows in `MilesCell`.
   */
  bidCostEth: number
}

/**
 * Fetches the miles-estimator config bundle (surplus rate + bid cost) from
 * `/api/config/gas-estimate`. Both values are written by the hourly cron and
 * persisted in Edge Config. Returns the default fallbacks until the fetch
 * completes.
 *
 * The dashboard uses both values: `surplusRate` drives the population-prior
 * fallback formula in `MilesCell`, and `bidCostEth` proxies the NULL
 * `bid_cost` on pending rows for the realized-data path. Bundling them
 * into one hook avoids two network calls per dashboard mount.
 */
export function useMilesEstimateConfig(): MilesEstimateConfig {
  const [config, setConfig] = useState<MilesEstimateConfig>({
    surplusRate: DEFAULT_SURPLUS_RATE,
    bidCostEth: DEFAULT_BID_COST_ETH,
  })

  useEffect(() => {
    let cancelled = false

    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config/gas-estimate")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setConfig((prev) => ({
          surplusRate:
            typeof data.surplusRate === "number" && data.surplusRate > 0
              ? data.surplusRate
              : prev.surplusRate,
          bidCostEth:
            typeof data.bidCostEth === "number" && data.bidCostEth > 0
              ? data.bidCostEth
              : prev.bidCostEth,
        }))
      } catch {
        // Defaults already set; nothing to do.
      }
    }

    fetchConfig()
    return () => {
      cancelled = true
    }
  }, [])

  return config
}
