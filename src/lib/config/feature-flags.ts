export const FEATURE_FLAGS = {
  show_global_stats: true,
  /** When true, SwapToast is always visible with placeholder ETH/USDC data for testing. Set to false for production. */
  test_swap_toast: false,
  /** When true, swap is gated by the "Swap Whitelist" Google Sheet; when false, all connected wallets can swap. */
  swap_whitelist_enabled: true,
  /** When true, users not on the whitelist see the landing page on the app route instead of the swap UI. */
  swapPrivateMode: true,
  /** When true, show Fast Miles UI: estimated miles on the swap form and confirmation modal, and the miles badge in the app header. Does NOT control the per-swap miles table on the dashboard — use `show_miles_dashboard_table` for that. */
  show_miles_estimate: true,
  /** When true, show the per-swap miles table (UserSwapsTable) on the dashboard. This is the only flag that gates that table. */
  show_miles_dashboard_table: false,
  /** When true, the quote hook always returns no liquidity, forcing the "This trade cannot be completed right now" button and "Why am I seeing this?" explainer link to appear for any token pair. Set to false for production. */
  test_no_liquidity: false,
  /** When true, show referral counts on the Miles leaderboard (sub-text under wallets, "Your Referrals" stat, progress line) and show the Referral Leaders card on the stats page. Set to false to hide until Fuul attribution data is verified accurate. */
  show_referral_counts: true,
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
