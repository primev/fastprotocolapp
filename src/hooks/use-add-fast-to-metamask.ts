import { useState } from "react"
import { toast } from "sonner"
import { NETWORK_CONFIG } from "@/lib/network-config"

export interface UseAddFastToMetamaskReturn {
  isProcessing: boolean
  addFastToMetamask: () => Promise<boolean>
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

      // Get MetaMask provider from window.ethereum only
      const ethereum = (window as any).ethereum

      if (!ethereum) {
        toast.error("MetaMask not found", {
          description: "Please install MetaMask to continue.",
        })
        return false
      }

      let provider: any = null

      // If multiple providers are installed, find MetaMask specifically
      if (ethereum.providers && Array.isArray(ethereum.providers)) {
        // Find MetaMask provider (checking for isMetaMask === true && !isRabby to avoid Rabby masquerading)
        provider = ethereum.providers.find((p: any) => p && p.isMetaMask === true && !p.isRabby)
      } else {
        // Single provider - verify it's MetaMask (not Rabby)
        if (ethereum.isMetaMask === true && !ethereum.isRabby) {
          provider = ethereum
        }
      }

      if (!provider || provider.isMetaMask !== true) {
        toast.error("MetaMask not found", {
          description: "Please install MetaMask to continue.",
        })
        return false
      }

      // Request connection with timeout
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
        // Timeout or other error
        toast.error("Connection issue", {
          description:
            reqError.message || "Unable to connect to MetaMask. Please check other wallets.",
        })
        return false
      }

      // Step 4: Add/update network
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
