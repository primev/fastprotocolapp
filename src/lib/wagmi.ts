"use client"

import { connectorsForWallets, type Wallet } from "@rainbow-me/rainbowkit"
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  rabbyWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { createConfig, http, fallback, createConnector } from "wagmi"
import { mock } from "wagmi/connectors"
import { mainnet } from "wagmi/chains"

const WHALE_WALLET_ADDRESS = "0x868daB0b8E21EC0a48b726A1ccf25826c78C6d7F"

// Minimal 32x32 placeholder icon (data URI) so we don't depend on external URLs
const MOCK_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect fill='%233898ff' width='32' height='32' rx='8'/%3E%3Ctext x='16' y='21' font-size='14' fill='white' text-anchor='middle' font-family='sans-serif'%3EM%3C/text%3E%3C/svg%3E"

const mockWallet = (): Wallet => ({
  id: "mock",
  name: "Mock Wallet",
  rdns: "me.rainbow.mock",
  iconUrl: MOCK_ICON,
  iconBackground: "#fff",
  installed: true,
  extension: {
    instructions: {
      learnMoreUrl: "https://wagmi.sh",
      steps: [
        {
          description: "Click the button below to connect your mock whale account.",
          step: "install",
          title: "Connect Mock",
        },
      ],
    },
  },
  // RainbowKit expects createConnector to return a CreateConnectorFn (factory).
  // mock() returns a CreateConnectorFn; wrap it to inject rkDetails for RainbowKit.
  createConnector: (walletDetails) => {
    const mockFn = mock({
      accounts: [WHALE_WALLET_ADDRESS],
      features: { reconnect: true },
    })
    return createConnector((config) => {
      const base = mockFn(config)
      return { ...base, rkDetails: walletDetails.rkDetails }
    })
  },
})

const isMobile =
  typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000"
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

const enableMock = process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET === "true"
const showMockWallet = enableMock

const recommendedGroup = {
  groupName: "Recommended",
  wallets: isMobile
    ? [metaMaskWallet, rabbyWallet, rainbowWallet, coinbaseWallet, walletConnectWallet]
    : [injectedWallet],
}

const walletList = [
  ...(showMockWallet ? [{ groupName: "Testing", wallets: [mockWallet] }] : []),
  recommendedGroup,
]

const connectors = connectorsForWallets(walletList, {
  appName: "Fast Protocol",
  projectId: projectId,
})

export const config = createConfig({
  chains: [mainnet],
  connectors,
  transports: {
    [mainnet.id]: fallback(
      [
        http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
        http("https://rpc.ankr.com/eth"),
        http(),
      ],
      { rank: true }
    ),
  },
  ssr: true,
})
