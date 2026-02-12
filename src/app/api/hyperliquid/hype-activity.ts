const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info"

/**
 * Returns true if the address has at least one fill (trade) on Hyperliquid.
 */
export async function hasActivity(address: string): Promise<boolean> {
  try {
    const response = await fetch(HYPERLIQUID_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "userFills",
        user: address,
      }),
    })
    const fills = await response.json()
    return Array.isArray(fills) && fills.length > 0
  } catch (error) {
    console.error("Failed to fetch user fills:", error)
    return false
  }
}
