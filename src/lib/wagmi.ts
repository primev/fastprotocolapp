import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  rabbyWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { createConfig, http, fallback } from "wagmi"
import { mainnet } from "wagmi/chains"
import { RPC_ENDPOINT } from "@/lib/network-config"

// 1. Detect environment (Safe for SSR - defaults to desktop for server render)
const isMobile =
  typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

// Get WalletConnect Project ID - required for mobile deep links
// Falls back to placeholder if not set (mobile deep links won't work, but desktop will)
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000"

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: isMobile
        ? [
            // MOBILE: Show specific apps to trigger Deep Links
            // These wallets use WalletConnect v2 to facilitate handshake between browser and app
            metaMaskWallet,
            rabbyWallet,
            rainbowWallet,
            coinbaseWallet,
            walletConnectWallet,
          ]
        : [
            // DESKTOP: Focus on browser extensions
            // injectedWallet detects all installed extensions (MetaMask, Rabby, etc.)
            injectedWallet,
          ],
    },
  ],
  {
    appName: "Fast Protocol",
    projectId: projectId,
  }
)

export const config = createConfig({
  chains: [mainnet],
  connectors,
  transports: {
    [mainnet.id]: fallback([
      http(RPC_ENDPOINT), // Fast RPC
      http(), // public fallback
    ]),
  },
  ssr: true,
})
