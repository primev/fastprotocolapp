const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info"
const HYPERLIQUID_EVM_RPC = "https://rpc.hyperliquid.xyz/evm"

/** HYPE token on HyperEVM. */
const HYPE_EVM_CONTRACT = "0x2222222222222222222222222222222222222222"
/** ERC20 balanceOf(address) selector. */
const BALANCE_OF_SELECTOR = "0x70a08231"

/** Mainnet spot pair index for HYPE (userFills uses "@107" for spot). */
const HYPE_SPOT_COIN = "@107"
/** Mainnet token index for HYPE (used if ledger returns token index). */
const HYPE_TOKEN_INDEX = 150

async function postInfo(payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(HYPERLIQUID_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return response.json()
}

function isHypeFill(coin: string | undefined): boolean {
  return coin === "HYPE" || coin === HYPE_SPOT_COIN
}

function ledgerHasHype(updates: unknown): boolean {
  if (!Array.isArray(updates)) return false
  return updates.some(
    (item: { coin?: string; token?: number }) =>
      item?.coin === "HYPE" || item?.token === HYPE_TOKEN_INDEX
  )
}

/** Fetches HYPE balance on HyperEVM via eth_call. Returns null on error. */
async function fetchEvmHypeBalance(walletAddress: string): Promise<bigint | null> {
  try {
    const paddedAddress = walletAddress.slice(2).toLowerCase().padStart(64, "0")
    const data = `${BALANCE_OF_SELECTOR}${paddedAddress}`
    const response = await fetch(HYPERLIQUID_EVM_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: HYPE_EVM_CONTRACT, data }, "latest"],
        id: 1,
      }),
    })
    const json = (await response.json()) as { result?: string; error?: unknown }
    if (json.error || typeof json.result !== "string") return null
    const hex = json.result
    if (hex === "0x" || hex.length < 3) return BigInt(0)
    return BigInt(hex)
  } catch {
    return null
  }
}

/**
 * Fetches HYPE balance for a wallet from Hyperliquid spot clearinghouse state.
 * Returns total HYPE balance (string) or "0" if none or on error.
 */
export async function fetchHypeBalance(walletAddress: string): Promise<string> {
  try {
    const data = (await postInfo({
      type: "spotClearinghouseState",
      user: walletAddress,
    })) as { balances?: Array<{ coin: string; total: string }> }

    const hypeData = data.balances?.find((item) => item.coin === "HYPE")
    return hypeData?.total ?? "0"
  } catch (error) {
    console.error("Failed to fetch HYPE balance:", error)
    return "0"
  }
}

function checkSpotHype(spotState: unknown): boolean {
  if (!spotState || typeof spotState !== "object" || !("balances" in spotState)) return false
  const balances = (spotState as { balances: Array<{ coin: string; total: string }> }).balances
  if (!Array.isArray(balances)) return false
  return Number(balances.find((b) => b.coin === "HYPE")?.total ?? 0) > 0
}

function checkFillsHype(fills: unknown): boolean {
  return Array.isArray(fills) && (fills as Array<{ coin?: string }>).some((f) => isHypeFill(f.coin))
}

/**
 * Returns true if the user has ever held HYPE (current balance, ledger updates, fills, or HyperEVM balance).
 * Runs spotClearinghouseState, userNonFundingLedgerUpdates, userFills, and HyperEVM balanceOf in parallel
 * and resolves with true as soon as any check returns true to reduce fetch time.
 */
export async function hasEverHeldHype(walletAddress: string): Promise<boolean> {
  const spotPromise = postInfo({ type: "spotClearinghouseState", user: walletAddress })
    .then(checkSpotHype)
    .catch(() => false)

  const ledgerPromise = postInfo({ type: "userNonFundingLedgerUpdates", user: walletAddress })
    .then(ledgerHasHype)
    .catch(() => false)

  const fillsPromise = postInfo({ type: "userFills", user: walletAddress })
    .then(checkFillsHype)
    .catch(() => false)

  const evmPromise = fetchEvmHypeBalance(walletAddress)
    .then((b) => b !== null && b > BigInt(0))
    .catch(() => false)

  return new Promise<boolean>((resolve) => {
    let settled = 0
    const total = 4
    const onSettle = (value: boolean) => {
      if (value) {
        resolve(true)
        return
      }
      settled += 1
      if (settled === total) resolve(false)
    }
    spotPromise.then(onSettle)
    ledgerPromise.then(onSettle)
    fillsPromise.then(onSettle)
    evmPromise.then(onSettle)
  })
}
