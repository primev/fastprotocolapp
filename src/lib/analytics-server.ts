/**
 * Server-side function to fetch cumulative successful transactions from analytics API
 * Calls the internal API route which handles the external API call
 */
export async function getCumulativeTransactions(): Promise<number | null> {
  try {
    // Call the internal API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/analytics/transactions`, {
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("Failed to fetch transactions:", response.statusText)
      return null
    }

    const data = await response.json()

    if (data.success && data.cumulativeSuccessfulTxs !== null) {
      return Number(data.cumulativeSuccessfulTxs)
    }

    return null
  } catch (error) {
    console.error("Error fetching cumulative transactions:", error)
    return null
  }
}

import { env } from "@/env/server"

/**
 * Server-side function to fetch current ETH price from Alchemy
 */
export async function getEthPrice(): Promise<number | null> {
  try {
    const apiKey = env.ALCHEMY_API_KEY

    if (!apiKey) {
      console.error("ALCHEMY_API_KEY not configured")
      return null
    }

    const response = await fetch(
      `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-symbol?symbols=ETH`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Failed to fetch ETH price:", response.status, errorText)
      return null
    }

    const data = await response.json()

    // Alchemy returns data in format:
    // {
    //   "data": [
    //     {
    //       "symbol": "ETH",
    //       "prices": [
    //         {
    //           "currency": "usd",
    //           "value": "2933.1463611734",
    //           "lastUpdatedAt": "2025-12-29T16:38:25Z"
    //         }
    //       ]
    //     }
    //   ]
    // }
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const ethData = data.data.find((item: any) => item.symbol === "ETH")
      if (ethData && ethData.prices && Array.isArray(ethData.prices) && ethData.prices.length > 0) {
        const usdPrice = ethData.prices.find((price: any) => price.currency === "usd")
        if (usdPrice && usdPrice.value) {
          return Number(usdPrice.value)
        }
      }
    }

    return null
  } catch (error) {
    console.error("Error fetching ETH price:", error)
    return null
  }
}

/**
 * Server-side function to fetch cumulative total transaction volume from analytics API
 * Calls the internal API route which handles the external API call
 */
export async function getCumulativeVolume(): Promise<number | null> {
  try {
    // Call the internal API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/analytics/volume`, {
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("Failed to fetch volume:", response.statusText)
      return null
    }

    const data = await response.json()

    if (data.success && data.cumulativeTotalTxVolEth !== null) {
      return Number(data.cumulativeTotalTxVolEth)
    }

    return null
  } catch (error) {
    console.error("Error fetching cumulative volume:", error)
    return null
  }
}
