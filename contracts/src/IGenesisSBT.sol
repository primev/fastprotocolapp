// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";

/// @title IGenesisSBT - Interface for GenesisSBT contract
interface IGenesisSBT is IERC721, IERC4906 {
    // =============================================================
    //                          ERRORS
    // =============================================================

    /// @dev Triggered when a token is not found.
    error TokenNotFound();

    /// @dev Triggered when trying to mint a token to an address that already has one.
    error TokenAlreadyMinted();

    /// @dev Triggered when trying to transfer a soul-bound token.
    error SoulBoundToken_TransferNotAllowed();

    /// @dev Triggered when trying to approve a soul-bound token.
    error SoulBoundToken_ApprovalNotAllowed();

    /// @dev Triggered when invalid recipients are provided.
    error InvalidRecipients();

    /// @dev prevent unintended contract interactions.
    error InvalidReceive();
    
    /// @dev prevent unintended contract interactions.
    error InvalidFallback();

    // =============================================================
    //                          FUNCTIONS
    // =============================================================

    /// @dev Initializes the contract
    /// @param asset The asset URI for the NFT
    /// @param owner The initial owner address
    function initialize(string calldata asset, address owner) external;

    /// @dev Mints a token to the caller
    function mint() external;

    /// @dev Allows the owner to mint tokens to multiple addresses without requiring payment
    /// @param to Array of addresses to mint tokens to. Skips addresses that already have tokens.
    function adminMint(address[] calldata to) external;

    /// @dev Returns the total supply of minted tokens
    /// @return The total number of tokens minted
    function totalSupply() external view returns (uint256);

    /// @dev Updates the asset URI for tokens
    /// @param assetURI New asset URI
    function setAssetURI(string calldata assetURI) external;

    /// @dev Updates the NFT name
    /// @param nftName New NFT name
    function setNftName(string calldata nftName) external;

    /// @dev Updates the description
    /// @param nftDescription New description
    function setNftDescription(string calldata nftDescription) external;

    /// @dev Returns the metadata URI for a token
    /// @param tokenId The token ID
    /// @return The metadata URI
    function tokenURI(uint256 tokenId) external view returns (string memory);

    /// @dev Pauses all minting
    function pause() external;

    /// @dev Unpauses all minting
    function unpause() external;
}

