import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
  rabbyWallet,
  trustWallet,
  uniswapWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { createConfig, http, fallback } from "wagmi"
import { mainnet } from "wagmi/chains"
import { RPC_ENDPOINT } from "@/lib/network-config"

// WalletConnect project ID - get one at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000"

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        coinbaseWallet,
        walletConnectWallet,
        rainbowWallet,
      ],
    },
    {
      groupName: "More",
      wallets: [
        rabbyWallet,
        trustWallet,
        uniswapWallet,
        injectedWallet,
      ],
    },
  ],
  {
    appName: "Fast Protocol",
    projectId,
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
