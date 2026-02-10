import type { EcosystemSet } from "./types"

const CHAIN_HYPERLIQUID = 999
const HYPERLIQUID_IMG = `/assets/hyperliquid-logo.png`
const HYPRURR_IMG = `/assets/hypurr-logo.png`

// Hypurr HFT holder - contract: 0x9125e2d6827a00b0f8330d6ef7bef07730bac685
// HYPE holder: contract address TBD — add when known
export const hyperliquidSets: readonly EcosystemSet[] = [
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    img: HYPERLIQUID_IMG,
    contracts: [
      {
        address: "0x9125e2d6827a00b0f8330d6ef7bef07730bac685",
        chainId: CHAIN_HYPERLIQUID,
        label: "Hypurr",
        kind: "erc20",
      },
      // HYPE: add entry with correct address when available, e.g. { address: "0x...", chainId: CHAIN_HYPERLIQUID, label: "HYPE", kind: "erc20" }
    ],
    customCriteria: ["active_depositor_trader"],
    comingSoon: true,
  },
  {
    id: "hyperliquid",
    name: "Hypurr",
    img: HYPRURR_IMG,
    contracts: [
      {
        address: "0x9125e2d6827a00b0f8330d6ef7bef07730bac685",
        chainId: CHAIN_HYPERLIQUID,
        label: "Hypurr",
        kind: "erc20",
      },
      // HYPE: add entry with correct address when available, e.g. { address: "0x...", chainId: CHAIN_HYPERLIQUID, label: "HYPE", kind: "erc20" }
    ],
    customCriteria: ["active_depositor_trader"],
    comingSoon: true,
  },
]
