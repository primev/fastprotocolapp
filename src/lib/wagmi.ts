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
import { mainnet, bsc, hyperliquid } from "wagmi/chains"
import { mock } from "wagmi/connectors"

const WHALE_WALLET_ADDRESS = "0x1da9c87e4a1a7487279dad2050579f4790583afe"

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

// 1. Environment Detection & Constants
const isMobile =
  typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000"

const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

// 2. Connector Configuration
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

// 3. Transport Logic (Alchemy as Default/Primary)
const rpcFallbacks = [
  // PRIMARY: Alchemy
  http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
    timeout: 10000,
    fetchOptions: { cache: "no-store" },
  }),

  // SECONDARY: Public Nodes
  // http("https://eth.llamarpc.com", { timeout: 10000 }),
  http("https://rpc.ankr.com/eth", { timeout: 10000 }),
  http("https://1rpc.io/eth", { timeout: 10000 }),

  // LAST RESORT: Standard Public Node
  http(),
]

const bscRpcFallbacks = [
  // PRIMARY: Alchemy
  http(`https://bnb-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
    timeout: 10000,
    fetchOptions: { cache: "no-store" },
  }),
  // SECONDARY: Public Nodes
  http("https://bsc-dataseed.binance.org", { timeout: 10000 }),
  http("https://bsc-dataseed1.defibit.io", { timeout: 10000 }),
  http("https://rpc.ankr.com/bsc", { timeout: 10000 }),
]

const hyperliquidRpcFallbacks = [
  // PRIMARY: Alchemy
  http(`https://hyperliquid-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
    timeout: 10000,
    fetchOptions: { cache: "no-store" },
  }),
  // SECONDARY: Public Nodes
  http("https://rpc.hypurrscan.io", { timeout: 10000 }),
  http("https://rpc.hyperliquid.xyz/evm", { timeout: 10000 }),
]

// 4. Final Config
export const config = createConfig({
  chains: [mainnet, bsc, hyperliquid],
  connectors,
  transports: {
    [mainnet.id]: fallback(rpcFallbacks, {
      rank: true, // This will periodically test latency and pick the best one from the list
    }),
    [bsc.id]: fallback(bscRpcFallbacks, { rank: true }),
    [hyperliquid.id]: fallback(hyperliquidRpcFallbacks, { rank: true }),
  },
  batch: {
    multicall: {
      batchSize: 1024,
      wait: 20, // Bundles multiple balance checks into one RPC call
    },
  },
  ssr: true,
})
