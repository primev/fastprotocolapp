"use client"

import { useState, useEffect } from "react"
import { PRO_MODE_MIN_USD } from "@/lib/pro-mode"

/**
 * Fetches the Pro mode USD threshold from edge config.
 * Falls back to the hardcoded default if the fetch fails.
 */
export function useProThreshold(): number {
  const [minUsd, setMinUsd] = useState(PRO_MODE_MIN_USD)

  useEffect(() => {
    fetch("/api/config/pro-threshold")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.minUsd === "number" && data.minUsd > 0) {
          setMinUsd(data.minUsd)
        }
      })
      .catch(() => {})
  }, [])

  return minUsd
}
