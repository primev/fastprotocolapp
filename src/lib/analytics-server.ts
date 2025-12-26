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

