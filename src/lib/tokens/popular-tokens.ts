/**
 * Curated "Popular tokens" list for the token selector.
 *
 * Uniswap's production interface sources its Popular Tokens list from a
 * backend GraphQL query (`topTokens` ordered by 24h USD volume). We don't
 * have that backend, so we mirror the UX with a hand-picked set of
 * mainnet blue chips — the same tokens that consistently sit at the top
 * of Uniswap's volume ranking.
 *
 * Addresses are lowercased for O(1) `Set` membership checks.
 */

import { ZERO_ADDRESS } from "@/lib/swap/constants"

/** Addresses are canonical Ethereum mainnet, lowercased. */
export const POPULAR_TOKEN_ADDRESSES: string[] = [
  ZERO_ADDRESS, // ETH
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
  "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", // stETH
  "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
  "0x5a98fcbea516cf06857215779fd812ca3bef1b32", // LDO
  "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", // MKR
  "0xd533a949740bb3306d119cc777fa900ba034cd52", // CRV
  "0xc00e94cb662c3520282e6f5717214004a7f26888", // COMP
  "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f", // SNX
  "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ENS
  "0x6982508145454ce325ddbe47a25d4ec3d2311933", // PEPE
  "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", // SHIB
  "0x4d224452801aced8b2f0aebe155379bb5d594381", // APE
  "0xb50721bcf8d664c30412cfbc6cf7a15145234ad1", // ARB (bridged)
  "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // MATIC
  "0xc944e90c64b2c07662a292be6244bdf05cda44a7", // GRT
  "0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0", // FXS
  "0xd33526068d116ce69f19a9ee46f0bd304f21a51f", // RPL
  "0x111111111117dc0aa78b770fa6a738034120c302", // 1INCH
]

/** Symbols shown in the top chip row, ordered to match Uniswap exactly. */
export const SUGGESTED_CHIP_SYMBOLS = ["ETH", "USDC", "USDT", "WETH", "WBTC"] as const
