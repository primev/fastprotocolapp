/**
 * Fast Protocol Network Configuration
 *
 * Network details for Ethereum Mainnet with Fast Protocol RPC
 */
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

export const FAST_PROTOCOL_NETWORK = {
  chainId: 1,
  chainName: "Ethereum Mainnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://fastrpc.mev-commit.xyz"],
  blockExplorerUrls: ["https://www.etherscan.io/"],
} as const

/**
 * Network configuration for wallet_addEthereumChain
 */
export const NETWORK_CONFIG = {
  chainId: `0x${FAST_PROTOCOL_NETWORK.chainId.toString(16)}`, // 0x1
  chainName: FAST_PROTOCOL_NETWORK.chainName,
  nativeCurrency: FAST_PROTOCOL_NETWORK.nativeCurrency,
  rpcUrls: FAST_PROTOCOL_NETWORK.rpcUrls,
  blockExplorerUrls: FAST_PROTOCOL_NETWORK.blockExplorerUrls,
} as const

/**
 * RPC endpoint for testing
 */
export const RPC_ENDPOINT = "https://fastrpc.mev-commit.xyz"
export const FALLBACK_RPC_ENDPOINT = `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`

/**
 * FastSwap API base URL for executor-submitted (ERC20) and user-submitted (ETH) swaps
 */
export const FASTSWAP_API_BASE = "https://fastrpc.mev-commit.xyz"

/**
 * When true, bypass real FastSwap API and contract; use dummy data and fake success.
 * Defaults to true in development so flows can be tested without production API.
 * Set NEXT_PUBLIC_FASTSWAP_DUMMY=false to use real API in dev; set to "true" in prod only for testing.
 */
export const USE_FASTSWAP_DUMMY =
  process.env.NEXT_PUBLIC_FASTSWAP_DUMMY === "true" ||
  (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_FASTSWAP_DUMMY !== "false")
