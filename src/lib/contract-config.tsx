export const CONTRACT_ABI = [
    { "inputs": [], "name": "mint", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }], "name": "getTokenIdByAddress", "outputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "stateMutability": "view", "type": "function" },
] as const;

export const CONTRACT_ADDRESS = "0xFAee8EDCDF7f7B2B56Ce78171714FC237f86ba7c";

// Default data for the SBT
export const MINT_PRICE = BigInt(0);
export const NFT_NAME = 'Genesis SBT';
export const NFT_DESCRIPTION = 'Your Genesis SBT proves you were early to Fast Protocol. Your progress will carry into the main Fast ecosystem at launch.';
export const NFT_ASSET = '/assets/sbt-asset.png';

