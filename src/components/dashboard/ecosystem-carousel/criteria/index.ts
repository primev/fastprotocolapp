export type { ContractEntry, ContractKind, CustomCriterion, EcosystemSet } from "./types"
export { ethereumSets } from "./ethereum"
export { hyperliquidSets } from "./hyperliquid"
import type { EcosystemSet } from "./types"
import { ethereumSets } from "./ethereum"
import { hyperliquidSets } from "./hyperliquid"

const combined: EcosystemSet[] = [...ethereumSets, ...hyperliquidSets]
combined.sort((a, b) => {
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
  return a.name.localeCompare(b.name)
})

export const ECOSYSTEM_SETS: readonly EcosystemSet[] = combined
