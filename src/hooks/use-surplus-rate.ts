"use client"

import { useState, useEffect } from "react"
import {
  DEFAULT_SURPLUS_BUCKETS,
  isSurplusBuckets,
  type SurplusBuckets,
} from "@/lib/surplus-rate"

/**
 * Fetches the size-bucketed surplus rates from Edge Config (updated daily by
 * cron). Callers use `pickSurplusRate(outputEth, buckets)` from
 * `lib/surplus-rate` to resolve a specific rate for a given swap size.
 *
 * Returns the default buckets until the fetch completes so consumers never
 * see `null`.
 */
export function useSurplusBuckets(): SurplusBuckets {
  const [buckets, setBuckets] = useState<SurplusBuckets>(DEFAULT_SURPLUS_BUCKETS)

  useEffect(() => {
    let cancelled = false

    const fetchBuckets = async () => {
      try {
        const res = await fetch("/api/config/gas-estimate")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && isSurplusBuckets(data.surplusBuckets)) {
          setBuckets(data.surplusBuckets)
        }
      } catch {
        // Fallback is already set
      }
    }

    fetchBuckets()
    return () => {
      cancelled = true
    }
  }, [])

  return buckets
}
