export const CONTRACT_ABI = [
  { inputs: [], name: "mint", outputs: [], stateMutability: "payable", type: "function" },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getTokenIdByAddress",
    outputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const

export const CONTRACT_ADDRESS = "0xd0E132C73C9425072AAB9256d63aa14D798D063A"

// Default data for the SBT
export const NFT_NAME = "Genesis SBT"
export const NFT_DESCRIPTION =
  "Marks you as early to Fast Protocol. Your progress carries into launch."
export const NFT_ASSET = "/assets/sbt-asset.png"
