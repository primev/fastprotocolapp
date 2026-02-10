const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info"

/**
 * Fetches HYPE balance for a wallet from Hyperliquid spot clearinghouse state.
 * Returns total HYPE balance (string) or "0" if none or on error.
 */
export async function fetchHypeBalance(walletAddress: string): Promise<string> {
  try {
    const response = await fetch(HYPERLIQUID_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "spotClearinghouseState",
        user: walletAddress,
      }),
    })
    const data = await response.json()
    console.log("data", data)
    const hypeData = data.balances?.find((item: { coin: string }) => item.coin === "HYPE")
    return hypeData?.total ?? "0"
  } catch (error) {
    console.error("Failed to fetch HYPE balance:", error)
    return "0"
  }
}
