export const FEATURE_FLAGS = {
  show_global_stats: true,
  /** When true, SwapToast is always visible with placeholder ETH/USDC data for testing. Set to false for production. */
  test_swap_toast: false,
}

/** Placeholder data for SwapToast test mode (ETH → USDC) */
export const TEST_SWAP_TOAST_PLACEHOLDER = {
  hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  tokenIn: {
    address: "0x0000000000000000000000000000000000000000",
    symbol: "ETH",
    decimals: 18,
    logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
    name: "Ethereum",
  },
  tokenOut: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
    name: "USDCoin",
  },
  amountIn: "1",
  amountOut: "3,500",
  status: "pending" as const,
  collapsed: false,
}
