"use client"

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

// 1. Environment Detection & Constants
const isMobile =
  typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000"

const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

// 2. Connector Configuration
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: isMobile
        ? [metaMaskWallet, rabbyWallet, rainbowWallet, coinbaseWallet, walletConnectWallet]
        : [injectedWallet],
    },
  ],
  {
    appName: "Fast Protocol",
    projectId: projectId,
  }
)

// 3. Transport Logic (Alchemy as Default/Primary)
const rpcFallbacks = [
  // PRIMARY: Alchemy
  http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
    timeout: 10000,
    fetchOptions: { cache: "no-store" },
  }),

  // SECONDARY: Public Nodes
  http("https://eth.llamarpc.com", { timeout: 10000 }),
  http("https://rpc.ankr.com/eth", { timeout: 10000 }),
  http("https://1rpc.io/eth", { timeout: 10000 }),

  // LAST RESORT: Standard Public Node
  http(),
]

// 4. Final Config
export const config = createConfig({
  chains: [mainnet],
  connectors,
  transports: {
    [mainnet.id]: fallback(rpcFallbacks, {
      rank: true, // This will periodically test latency and pick the best one from the list
    }),
  },
  batch: {
    multicall: {
      batchSize: 1024,
      wait: 20, // Bundles multiple balance checks into one RPC call
    },
  },
  ssr: true,
})
