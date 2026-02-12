export type ContractKind = "erc721" | "erc20"

export type ContractEntry = {
  address: `0x${string}`
  chainId: number
  label: string
  /** Defaults to "erc721" when omitted for backward compatibility */
  kind?: ContractKind
}

export type CustomCriterion = "active_depositor_trader" | "hype_holder"

export type EcosystemSet = {
  id: string
  name: string
  img: string
  /** Chain for this set (used for card label/logo). Fallback: contracts[0]?.chainId. */
  chainId?: number
  contracts: readonly ContractEntry[]
  comingSoon?: boolean
  /** Non-contract criteria (e.g. API or user_activity checks) */
  customCriteria?: readonly CustomCriterion[]
  /** Short sentence shown on the back of the card (e.g. verification criteria). Use "any" when multiple collections. */
  criteriaStatement: string
  /** Optional single URL for "Learn more". Used when there is only one collection/link. */
  criteriaLink?: string
  /** When multiple collections: list each as an individual link (label + url). Statement should include "any". */
  criteriaLinks?: readonly { label: string; url: string }[]
  createdAt: number
}
