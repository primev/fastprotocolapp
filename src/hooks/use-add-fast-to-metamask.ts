import { useState } from "react"
import { toast } from "sonner"
import { NETWORK_CONFIG } from "@/lib/network-config"

export interface UseAddFastToMetamaskReturn {
  isProcessing: boolean
  addFastToMetamask: () => Promise<boolean>
}

/**
 * Discover MetaMask via EIP-6963 provider announcements.
 * This works even when MetaMask is locked (unlike window.ethereum which may not be injected).
 */
function discoverMetaMaskEIP6963(): Promise<any | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 500)

    function handler(event: any) {
      const info = event.detail?.info
      const provider = event.detail?.provider
      // MetaMask's RDNS is "io.metamask" — match it and exclude Rabby
      if (info?.rdns === "io.metamask" || (provider?.isMetaMask && !provider?.isRabby)) {
        clearTimeout(timeout)
        window.removeEventListener("eip6963:announceProvider", handler)
        resolve(provider)
      }
    }

    window.addEventListener("eip6963:announceProvider", handler)
    // Ask all installed wallets to announce themselves
    window.dispatchEvent(new Event("eip6963:requestProvider"))
  })
}

export function useAddFastToMetamask(): UseAddFastToMetamaskReturn {
  const [isProcessing, setIsProcessing] = useState(false)

  const addFastToMetamask = async (): Promise<boolean> => {
    setIsProcessing(true)

    try {
      if (typeof window === "undefined") {
        toast.error("MetaMask not found", {
          description: "Please install MetaMask to continue.",
        })
        return false
      }

      // Try EIP-6963 discovery first (works even when MetaMask is locked)
      let provider = await discoverMetaMaskEIP6963()

      // Fall back to window.ethereum if EIP-6963 didn't find MetaMask
      if (!provider) {
        const ethereum = (window as any).ethereum
        if (ethereum?.providers && Array.isArray(ethereum.providers)) {
          provider = ethereum.providers.find((p: any) => p && p.isMetaMask === true && !p.isRabby)
        } else if (ethereum?.isMetaMask === true && !ethereum?.isRabby) {
          provider = ethereum
        }
      }

      if (!provider) {
        toast.error("MetaMask not found", {
          description: "Please install MetaMask to continue.",
        })
        return false
      }

      // Request connection with timeout — this will prompt MetaMask to unlock
      const connectTimeout = 1000 * 30 // 30 seconds
      const connectPromise = provider.request({ method: "eth_requestAccounts" })
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "MetaMask connection timed out. Please check other wallets are disconnected and try again."
              )
            ),
          connectTimeout
        )
      )

      try {
        await Promise.race([connectPromise, timeoutPromise])
      } catch (reqError: any) {
        if (reqError?.code === 4001) {
          // User rejected connection
          return false
        }
        toast.error("Connection issue", {
          description:
            reqError.message || "Unable to connect to MetaMask. Please check other wallets.",
        })
        return false
      }

      // Add/update network
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [NETWORK_CONFIG],
      })

      return true
    } catch (error: any) {
      if (error?.code === 4001) {
        toast("Request cancelled", {
          description: "You cancelled the network addition request.",
        })
      } else {
        toast.error("Failed to add network", {
          description: error?.message || "Failed to add Fast Protocol network to your wallet.",
        })
      }
      return false
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    isProcessing,
    addFastToMetamask,
  }
}
