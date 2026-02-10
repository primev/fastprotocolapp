export type ContractKind = "erc721" | "erc20"

export type ContractEntry = {
  address: `0x${string}`
  chainId: number
  label: string
  /** Defaults to "erc721" when omitted for backward compatibility */
  kind?: ContractKind
}

export type CustomCriterion = "active_depositor_trader"

export type EcosystemSet = {
  id: string
  name: string
  img: string
  contracts: readonly ContractEntry[]
  comingSoon?: boolean
  /** Non-contract criteria (e.g. API or user_activity checks) */
  customCriteria?: readonly CustomCriterion[]
}
