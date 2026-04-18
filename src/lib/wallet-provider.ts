/**
 * Returns the display name of the browser wallet that's actually active
 * (not merely installed), or null if none is detected.
 *
 * Detection order matters. Several wallets impersonate others by setting
 * multiple `is*` flags at once:
 *   - Brave injects BOTH `isBraveWallet` and `isMetaMask` for dApp compat.
 *   - Rabby injects `isMetaMask` too.
 * So we must check in order of specificity: most-specific flag first
 * (Brave → Rabby → MetaMask → Coinbase), otherwise a Brave user is
 * rendered as "MetaMask" in the UI.
 *
 * EIP-1193 provides `window.ethereum`, but browsers with multiple
 * injected wallets expose `window.ethereum.providers` (array) or
 * even `window.ethereum` as an array directly — we handle both shapes.
 */
export function getActiveProviderName(): string | null {
  if (typeof window === "undefined") return null

  const win = window as any
  if (!win.ethereum) return null

  const provider = win.ethereum

  // Shape 1: window.ethereum is itself an array. The first entry is the
  // most-recently-active provider.
  if (Array.isArray(provider)) {
    const activeProvider = provider[0]
    if (activeProvider?.isBraveWallet) return "Brave Wallet"
    if (activeProvider?.isRabby) return "Rabby"
    if (activeProvider?.isMetaMask) return "MetaMask"
    if (activeProvider?.isCoinbaseWallet) return "Coinbase Wallet"
  }

  // Shape 2: window.ethereum.providers is an array; window.ethereum is still
  // the current default provider, carrying its own `is*` flags.
  if (provider.providers && Array.isArray(provider.providers)) {
    // First try flags directly on the default provider object.
    if (provider.isBraveWallet) return "Brave Wallet"
    if (provider.isRabby) return "Rabby"
    if (provider.isMetaMask) return "MetaMask"
    if (provider.isCoinbaseWallet) return "Coinbase Wallet"

    // No flags on the default? Fall back to the first entry in .providers.
    const firstProvider = provider.providers[0]
    if (firstProvider?.isBraveWallet) return "Brave Wallet"
    if (firstProvider?.isRabby) return "Rabby"
    if (firstProvider?.isMetaMask) return "MetaMask"
    if (firstProvider?.isCoinbaseWallet) return "Coinbase Wallet"

    // Last resort: walk the array and find the entry that's identity-equal
    // to `provider` (i.e. the one EIP-1193 actually hands dapps).
    for (const p of provider.providers) {
      if (p === provider && p.isBraveWallet) return "Brave Wallet"
      if (p === provider && p.isRabby) return "Rabby"
      if (p === provider && p.isMetaMask) return "MetaMask"
      if (p === provider && p.isCoinbaseWallet) return "Coinbase Wallet"
    }
  }

  // Shape 3: single provider, just a plain object with flags.
  if (provider.isBraveWallet) return "Brave Wallet"
  if (provider.isRabby) return "Rabby"
  if (provider.isMetaMask) return "MetaMask"
  if (provider.isCoinbaseWallet) return "Coinbase Wallet"

  return null
}

/**
 * Get wallet name from wagmi connector
 * Uses connector properties first, then provider detection as fallback
 */
export function getWalletName(connector: any): string {
  if (!connector) {
    return getActiveProviderName() || "Browser Wallet"
  }

  // Check connector's wallet metadata/ID first (most reliable)
  const connectorId = (connector.id || "").toLowerCase()

  // Check for Brave first (before Rabby) to avoid misdetection
  if (connectorId.includes("brave")) {
    return "Brave Wallet"
  }

  // Check for Rabby connector IDs
  if (connectorId.includes("rabby") || connectorId === "io.rabby") {
    return "Rabby"
  }

  // Check for MetaMask connector IDs
  if (
    connectorId.includes("metamask") ||
    connectorId === "io.metamask" ||
    connectorId === "io.metamask.snap"
  ) {
    return "MetaMask"
  }

  // First, try to get the actual provider from the connector
  // This is the most reliable way to identify which wallet is connected
  try {
    const connectorProvider = connector.getProvider?.()
    if (connectorProvider) {
      // Check Brave first to avoid misdetection
      if (connectorProvider.isBraveWallet) return "Brave Wallet"
      if (connectorProvider.isRabby) return "Rabby"
      if (connectorProvider.isMetaMask) return "MetaMask"
      if (connectorProvider.isCoinbaseWallet) return "Coinbase Wallet"
    }
  } catch {
    // Ignore errors getting provider
  }

  // Also check if connector has a provider property directly
  if (connector.provider) {
    const provider = connector.provider
    // Check Brave first to avoid misdetection
    if (provider.isBraveWallet) return "Brave Wallet"
    if (provider.isRabby) return "Rabby"
    if (provider.isMetaMask) return "MetaMask"
    if (provider.isCoinbaseWallet) return "Coinbase Wallet"
  }

  // Check connector RDNS (Reverse Domain Name System) - most reliable identifier
  const rdns = (connector.rdns || "").toLowerCase()
  if (rdns) {
    // Check Brave first to avoid misdetection
    if (rdns.includes("brave")) return "Brave Wallet"
    if (rdns.includes("rabby")) return "Rabby"
    if (rdns === "io.metamask" || rdns.includes("metamask")) return "MetaMask"
    if (rdns.includes("coinbase")) return "Coinbase Wallet"
    if (rdns.includes("trust")) return "Trust Wallet"
  }

  // Check connector name
  const connectorName = (connector.name || "").toLowerCase()
  if (connectorName) {
    // Check Brave first to avoid misdetection
    if (connectorName.includes("brave")) return "Brave Wallet"
    if (connectorName.includes("rabby")) return "Rabby"
    if (connectorName.includes("metamask")) return "MetaMask"
    if (connectorName.includes("coinbase")) return "Coinbase Wallet"
    if (connectorName.includes("trust")) return "Trust Wallet"

    // Format connector name nicely for unknown wallets
    const formatted = (connector.name || "")
      .replace(/^io\./g, "")
      .replace(/\./g, " ")
      .split(" ")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")

    // Don't return generic names like "Browser Wallet" or "Injected"
    if (formatted.toLowerCase() === "browser wallet" || formatted.toLowerCase() === "injected") {
      // Fall through to provider detection
    } else {
      return formatted
    }
  }

  // Fallback to provider detection - check which wallet is actually active
  return getActiveProviderName() || "Browser Wallet"
}

/**
 * Get the wallet type from connector ID
 * Returns 'metamask', 'rabby', 'brave', 'coinbase', or null
 */
export function getWalletTypeFromConnector(connector: any): string | null {
  if (!connector) return null

  const connectorId = (connector.id || "").toLowerCase()
  const rdns = (connector.rdns || "").toLowerCase()
  const name = (connector.name || "").toLowerCase()

  // Check connector ID first (most reliable)
  if (connectorId.includes("brave")) return "brave"
  if (connectorId.includes("rabby") || connectorId === "io.rabby") return "rabby"
  if (
    connectorId.includes("metamask") ||
    connectorId === "io.metamask" ||
    connectorId === "io.metamask.snap"
  )
    return "metamask"
  if (connectorId.includes("coinbase")) return "coinbase"

  // Check RDNS
  if (rdns.includes("brave")) return "brave"
  if (rdns.includes("rabby")) return "rabby"
  if (rdns === "io.metamask" || rdns.includes("metamask")) return "metamask"
  if (rdns.includes("coinbase")) return "coinbase"

  // Check name
  if (name.includes("brave")) return "brave"
  if (name.includes("rabby")) return "rabby"
  if (name.includes("metamask")) return "metamask"
  if (name.includes("coinbase")) return "coinbase"

  return null
}

/**
 * Get the specific provider for the connected wallet
 * Ensures no other wallet interferes with the transaction
 *
 * @param connector - The wagmi connector instance
 * @returns The provider for the connected wallet, or null if not found
 */
export async function getProviderForConnector(connector: any): Promise<any | null> {
  if (!connector || typeof window === "undefined") {
    return null
  }

  const walletType = getWalletTypeFromConnector(connector)
  if (!walletType) {
    // Unknown wallet type - fallback to connector provider
    try {
      return await connector.getProvider()
    } catch {
      return null
    }
  }

  const ethereum = (window as any).ethereum
  if (!ethereum) {
    return null
  }

  let provider: any = null

  // If multiple providers are installed, find the specific one
  if (ethereum.providers && Array.isArray(ethereum.providers)) {
    // Find provider by wallet type
    switch (walletType) {
      case "metamask":
        provider = ethereum.providers.find((p: any) => p && p.isMetaMask === true && !p.isRabby)
        break
      case "rabby":
        provider = ethereum.providers.find((p: any) => p && p.isRabby === true)
        break
      case "brave":
        provider = ethereum.providers.find((p: any) => p && p.isBraveWallet === true)
        break
      case "coinbase":
        provider = ethereum.providers.find((p: any) => p && p.isCoinbaseWallet === true)
        break
    }
  } else {
    // Single provider - verify it matches the wallet type
    switch (walletType) {
      case "metamask":
        if (ethereum.isMetaMask && !ethereum.isRabby) {
          provider = ethereum
        }
        break
      case "rabby":
        if (ethereum.isRabby) {
          provider = ethereum
        }
        break
      case "brave":
        if (ethereum.isBraveWallet) {
          provider = ethereum
        }
        break
      case "coinbase":
        if (ethereum.isCoinbaseWallet) {
          provider = ethereum
        }
        break
    }
  }

  // If we found a provider, validate it matches the connector
  if (provider) {
    try {
      const connectorProvider = await connector.getProvider()
      // If connector provider exists and is the same instance or matches wallet type, use it
      if (connectorProvider) {
        // Verify the connector provider matches the wallet type
        let isValid = false
        switch (walletType) {
          case "metamask":
            isValid = connectorProvider.isMetaMask === true && !connectorProvider.isRabby
            break
          case "rabby":
            isValid = connectorProvider.isRabby === true
            break
          case "brave":
            isValid = connectorProvider.isBraveWallet === true
            break
          case "coinbase":
            isValid = connectorProvider.isCoinbaseWallet === true
            break
        }

        if (isValid) {
          // Prefer connector provider if it's the same instance or matches
          if (
            connectorProvider === provider ||
            (walletType === "metamask" &&
              connectorProvider.isMetaMask &&
              !connectorProvider.isRabby) ||
            (walletType === "rabby" && connectorProvider.isRabby) ||
            (walletType === "brave" && connectorProvider.isBraveWallet) ||
            (walletType === "coinbase" && connectorProvider.isCoinbaseWallet)
          ) {
            return connectorProvider
          }
        }
      }
    } catch {
      // If we can't get connector provider, use the one we found
    }
  }

  // Fallback: try connector provider if we didn't find a specific one
  if (!provider) {
    try {
      const connectorProvider = await connector.getProvider()
      if (connectorProvider) {
        // Validate it matches the wallet type
        let isValid = false
        switch (walletType) {
          case "metamask":
            isValid = connectorProvider.isMetaMask === true && !connectorProvider.isRabby
            break
          case "rabby":
            isValid = connectorProvider.isRabby === true
            break
          case "brave":
            isValid = connectorProvider.isBraveWallet === true
            break
          case "coinbase":
            isValid = connectorProvider.isCoinbaseWallet === true
            break
        }
        if (isValid) {
          return connectorProvider
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return provider
}
