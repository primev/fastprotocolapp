import type { EcosystemSet } from "./types"

const CHAIN_HYPERLIQUID = 999

const ASSETS_URL = process.env.NEXT_PUBLIC_R2_BASE_URL

const HYPERLIQUID_LOGO_IMG = `${ASSETS_URL}/hyperliquid-logo.png`
const HYPRURR_IMG = `${ASSETS_URL}/nfts/hypurr-logo.png`

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
    createdAt: 1770829242,
  },
  {
    id: "hype_holder",
    name: "HYPE HOLDER",
    img: HYPERLIQUID_LOGO_IMG,
    chainId: CHAIN_HYPERLIQUID,
    contracts: [],
    customCriteria: ["hype_holder"],
    comingSoon: false,
    criteriaStatement: "Hold a HYPE balance on Hyperliquid.",
    criteriaLink: "https://app.hyperliquid.xyz/portfolio",
    createdAt: 1770829242,
  },
  {
    id: "hyperliquid_activity",
    name: "ACTIVE USER",
    img: HYPERLIQUID_LOGO_IMG,
    chainId: CHAIN_HYPERLIQUID,
    contracts: [],
    customCriteria: ["active_depositor_trader"],
    comingSoon: false,
    criteriaStatement: "Have done at least one trade or deposit on Hyperliquid.",
    criteriaLink: "https://app.hyperliquid.xyz/portfolio",
    createdAt: 1770829242,
  },
]
