/**
 * Fast Protocol Network Configuration
 * 
 * Network details for Ethereum Mainnet with Fast Protocol RPC
 */
export const FAST_PROTOCOL_NETWORK = {
  chainId: 1,
  chainName: 'Ethereum Mainnet (Fast Protocol)',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://fastrpc.mev-commit.xyz'],
  blockExplorerUrls: ['https://www.etherscan.io/'],
} as const;

/**
 * Network configuration for wallet_addEthereumChain
 */
export const NETWORK_CONFIG = {
  chainId: `0x${FAST_PROTOCOL_NETWORK.chainId.toString(16)}`, // 0x1
  chainName: FAST_PROTOCOL_NETWORK.chainName,
  nativeCurrency: FAST_PROTOCOL_NETWORK.nativeCurrency,
  rpcUrls: FAST_PROTOCOL_NETWORK.rpcUrls,
  blockExplorerUrls: FAST_PROTOCOL_NETWORK.blockExplorerUrls,
} as const;

/**
 * RPC endpoint for testing
 */
export const RPC_ENDPOINT = 'https://fastrpc.mev-commit.xyz';
