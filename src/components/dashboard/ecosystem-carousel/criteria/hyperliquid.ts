import type { EcosystemSet } from "./types"

const CHAIN_HYPERLIQUID = 999
const HYPERLIQUID_IMG = `/assets/hyperliquid-logo.png`
const HYPRURR_IMG = `/assets/hypurr-logo.png`

export const hyperliquidSets: readonly EcosystemSet[] = [
  {
    id: "hypurr",
    name: "Hypurr",
    img: HYPRURR_IMG,
    chainId: CHAIN_HYPERLIQUID,
    contracts: [
      {
        address: "0x9125e2d6827a00b0f8330d6ef7bef07730bac685",
        chainId: CHAIN_HYPERLIQUID,
        label: "Hypurr",
        kind: "erc20",
      },
    ],
    comingSoon: false,
    criteriaStatement: "Hold a balance in Hypurr HFT.",
    criteriaLink: "https://drip.trade/collections/hypurr",
  },
  {
    id: "hype",
    name: "HYPE HOLDER",
    img: HYPERLIQUID_IMG,
    chainId: CHAIN_HYPERLIQUID,
    contracts: [],
    customCriteria: ["hype_holder"],
    comingSoon: false,
    criteriaStatement: "Hold a HYPE balance on Hyperliquid.",
    criteriaLink: "https://app.hyperliquid.xyz/portfolio",
  },
  {
    id: "hyperliquid_activity",
    name: "ACTIVE USER",
    img: HYPERLIQUID_IMG,
    chainId: CHAIN_HYPERLIQUID,
    contracts: [],
    customCriteria: ["active_depositor_trader"],
    comingSoon: false,
    criteriaStatement: "Have done at least one trade or deposit on Hyperliquid.",
    criteriaLink: "https://app.hyperliquid.xyz/portfolio",
  },
]
