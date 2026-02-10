export type { ContractEntry, ContractKind, CustomCriterion, EcosystemSet } from "./types"
export { ethereumSets } from "./ethereum"
export { hyperliquidSets } from "./hyperliquid"
import { ethereumSets } from "./ethereum"
import { hyperliquidSets } from "./hyperliquid"

export const ECOSYSTEM_SETS = [...ethereumSets, ...hyperliquidSets] as const
