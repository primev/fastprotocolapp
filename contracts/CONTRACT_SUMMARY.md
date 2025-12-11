# GenesisSBT Contract Summary

## Core Features
- **Soul Bound Token (SBT)** - Non-transferable ERC721 tokens that cannot be moved between addresses
- **UUPS Upgradeable** - Universal Upgradeable Proxy Standard (UUPS) implementation for contract upgrades
- **On-Chain Metadata** - Base64-encoded JSON metadata stored entirely on-chain
- **Pinata Storage** - NFT image assets stored on Pinata IPFS (only off-chain component)

## Minting Capabilities
- **Public Minting** - Users can mint one token per address for a fee
- **Admin Batch Minting** - Owner can mint to multiple addresses in one transaction
- **Skip Logic** - Admin minting automatically skips addresses that already have tokens
- **Price Enforcement** - Requires payment equal to or greater than the mint price

## Access Control
- **Ownable2Step** - Two-step ownership transfer for enhanced security
- **Pausable** - Owner can pause/unpause minting operations
- **Owner-Only Functions** - Admin minting, metadata updates, and configuration restricted to owner

## Metadata Management
- **Dynamic Asset URI** - Owner can update the image URI for all tokens (typically Pinata IPFS links)
- **Customizable Properties** - Owner can set name and description metadata
- **Token URI Generation** - Returns base64-encoded JSON with name, id, image, and description
- **Off-Chain Assets** - Image files stored on Pinata IPFS (only off-chain component of the system)

## Configuration
- **Mint Price** - Configurable minting price (updatable by owner)
- **Initialization** - Sets asset URI, owner, and mint price on deployment

## Transfer Restrictions
- **Non-Transferable** - Tokens cannot be transferred between addresses
- **Minting Allowed** - New tokens can be minted
- **Burning Allowed** - Tokens can be burned (transferred to address(0))

## Error Handling
- `TokenNotFound` - Token ID doesn't exist
- `TokenAlreadyMinted` - Address already has a token
- `SoulBoundToken_TransferNotAllowed` - Transfer attempts are blocked
- `InvalidRecipients` - Empty array passed to adminMint
- `InsufficientFunds` - Payment below mint price

## View Functions
- `totalSupply()` - Returns total number of minted tokens
- `tokenURI(uint256)` - Returns base64-encoded JSON metadata for a token
- `balanceOf(address)` - Standard ERC721 balance check
- `ownerOf(uint256)` - Standard ERC721 owner lookup

## Security Features
- **Reentrancy Protection** - Uses OpenZeppelin's safe minting functions
- **Initializer Pattern** - Prevents re-initialization attacks
- **Two-Step Ownership** - Reduces risk of accidental ownership transfer
- **UUPS Upgrade Authorization** - Only owner can authorize contract upgrades

## Upgradeability
- **UUPS Proxy Pattern** - Contract deployed behind ERC1967 proxy for upgradeability
- **Owner-Controlled Upgrades** - Only contract owner can authorize upgrades via `_authorizeUpgrade`
- **Storage Layout Preservation** - Upgrades must maintain storage layout compatibility

