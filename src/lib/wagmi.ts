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

// Build fallback RPC chain with timeout configuration
const rpcFallbacks = [
  http(RPC_ENDPOINT, {
    timeout: 10000, // 10 second timeout
    fetchOptions: { cache: "no-store" },
  }), // Fast RPC (primary)
]

// Add Alchemy fallback if API key is available
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
if (alchemyApiKey && alchemyApiKey !== "undefined") {
  rpcFallbacks.push(
    http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
      timeout: 10000,
      fetchOptions: { cache: "no-store" },
    })
  )
}

// Add public RPC endpoints as final fallback with timeouts
rpcFallbacks.push(
  http("https://eth.llamarpc.com", {
    timeout: 10000,
    fetchOptions: { cache: "no-store" },
  }), // LlamaRPC public endpoint
  http("https://rpc.ankr.com/eth", {
    timeout: 10000,
    fetchOptions: { cache: "no-store" },
  }), // Ankr public endpoint
  http("https://ethereum.publicnode.com", {
    timeout: 10000,
    fetchOptions: { cache: "no-store" },
  }), // PublicNode endpoint
  http("https://1rpc.io/eth", {
    timeout: 10000,
    fetchOptions: { cache: "no-store" },
  }), // 1RPC endpoint
  http() // Default public fallback
)

export const config = createConfig({
  chains: [mainnet],
  connectors,
  transports: {
    [mainnet.id]: fallback(rpcFallbacks),
  },
  ssr: true,
})
