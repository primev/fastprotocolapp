import { useState, useEffect } from "react"
import { Connector } from "wagmi"

export interface UseWalletInfoReturn {
  walletName: string
  walletIcon: string | null
}

/**
 * Helper function to identify wallet from connector ID
 */
function getWalletNameFromId(id: string | undefined): string | null {
  if (!id) return null
  const idLower = id.toLowerCase()
  if (idLower.includes("rabby") || idLower === "io.rabby") return "Rabby Wallet"
  if (idLower.includes("metamask") || idLower === "io.metamask") return "MetaMask"
  if (idLower.includes("coinbase")) return "Coinbase Wallet"
  if (idLower.includes("brave")) return "Brave Wallet"
  if (idLower.includes("trust")) return "Trust Wallet"
  return null
}

/**
 * Hook for detecting wallet name and icon from connector
 */
export function useWalletInfo(
  connector: Connector | undefined,
  isConnected: boolean
): UseWalletInfoReturn {
  const [walletName, setWalletName] = useState<string>("Browser Wallet")
  const [walletIcon, setWalletIcon] = useState<string | null>(null)

  useEffect(() => {
    if (!connector || !isConnected) {
      setWalletName("Browser Wallet")
      setWalletIcon(null)
      return
    }

    const updateWalletInfo = () => {
      const connectorId = connector?.id
      let name = connector?.name || null
      let icon =
        (connector as any)?.icon ||
        (connector as any)?.iconUrl ||
        (connector as any)?.logoUrl ||
        null

      // If name is "Browser Wallet" or missing, try to identify by connector ID
      if (!name || name === "Browser Wallet" || name === "Injected") {
        const idBasedName = getWalletNameFromId(connectorId)
        if (idBasedName) {
          name = idBasedName
        }
      }

      // Update wallet name - prefer identified name, otherwise keep current if it's a known wallet
      if (name && name !== "Browser Wallet" && name !== "Injected") {
        setWalletName(name)
      } else {
        // Keep current wallet name during transitions, don't reset to Browser Wallet
        setWalletName((prev) => {
          if (prev && prev !== "Browser Wallet" && prev !== "Injected") {
            return prev // Keep known wallet name during transition
          }
          return name || "Browser Wallet"
        })
      }

      // Only update icon if we have one, otherwise keep the previous during transitions
      if (icon) {
        setWalletIcon(icon)
      } else {
        // Don't clear icon during injected transition - keep previous icon
        if (connectorId !== "injected" && !isConnected) {
          setWalletIcon(null)
        }
        // Otherwise keep the previous icon during transitions
      }
    }

    // Update immediately
    updateWalletInfo()

    // Also try after a short delay in case properties load asynchronously
    const timeoutId = setTimeout(updateWalletInfo, 100)

    // Poll for changes (in case connector properties load late)
    let lastName = walletName // Use current state as starting point
    let lastIcon = walletIcon
    let hasFoundGoodName = walletName !== "Browser Wallet"

    const intervalId = setInterval(() => {
      let currentName = connector?.name || null
      let currentIcon =
        (connector as any)?.icon ||
        (connector as any)?.iconUrl ||
        (connector as any)?.logoUrl ||
        null

      // Try to identify by ID if name is missing
      if (!currentName || currentName === "Browser Wallet" || currentName === "Injected") {
        const idBasedName = getWalletNameFromId(connector?.id)
        if (idBasedName) {
          currentName = idBasedName
        }
      }

      // Update name if we found a valid one and it's different
      if (currentName && currentName !== "Browser Wallet" && currentName !== "Injected") {
        if (currentName !== lastName) {
          setWalletName(currentName)
          lastName = currentName
          hasFoundGoodName = true
        }
      }

      // Update icon if we found one
      if (currentIcon && currentIcon !== lastIcon) {
        setWalletIcon(currentIcon)
        lastIcon = currentIcon
        console.log("Wallet info updated via polling:", { name: currentName, icon: currentIcon })
        if (hasFoundGoodName && currentIcon) {
          clearInterval(intervalId) // Stop polling once we have both name and icon
        }
      }
    }, 200)

    // Stop polling after 3 seconds max
    const maxTimeoutId = setTimeout(() => {
      clearInterval(intervalId)
    }, 3000)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
      clearTimeout(maxTimeoutId)
    }
  }, [connector, connector?.id, connector?.name, isConnected])

  return {
    walletName,
    walletIcon,
  }
}
