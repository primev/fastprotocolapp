import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets"
import { createConfig, http, fallback } from "wagmi"
import { mainnet } from "wagmi/chains"
import { RPC_ENDPOINT } from "@/lib/network-config"

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet],
    },
  ],
  {
    appName: "Fast Protocol",
    projectId: "00000000000000000000000000000000",
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
