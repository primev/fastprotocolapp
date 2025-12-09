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

    /// @dev Triggered when invalid recipients are provided.
    error InvalidRecipients();

    /// @dev Triggered when the user has insufficient funds.
    /// @param required The required amount
    /// @param provided The provided amount
    error InsufficientFunds(uint256 required, uint256 provided);

    // =============================================================
    //                          EVENTS
    // =============================================================

    /// @dev Emitted when tokens are successfully minted.
    /// @param recipient The address that received the tokens
    /// @param quantity The number of tokens minted
    event TokensMinted(address indexed recipient, uint256 quantity);
    
    // =============================================================
    //                          FUNCTIONS
    // =============================================================

    /// @dev Initializes the contract
    /// @param asset The asset URI for the NFT
    /// @param owner The initial owner address
    /// @param mintPrice The mint price for tokens
    /// @param treasuryReceiver The address that receives mint payments
    function initialize(string calldata asset, address owner, uint256 mintPrice, address treasuryReceiver) external;

    /// @dev Mints a token to the caller
    function mint() external payable;

    /// @dev Allows the owner to mint tokens to multiple addresses without requiring payment
    /// @param to Array of addresses to mint tokens to. Skips addresses that already have tokens.
    function adminMint(address[] calldata to) external;

    /// @dev Returns the total supply of minted tokens
    /// @return The total number of tokens minted
    function totalSupply() external view returns (uint256);

    /// @dev Updates the asset URI for tokens
    /// @param assetURI New asset URI
    function setAssetURI(string calldata assetURI) external;

    /// @dev Updates the metadata properties
    /// @param nftName New NFT name
    /// @param description New description
    function setMetadataProperties(string calldata nftName, string calldata description) external;

    /// @dev Updates the mint price
    /// @param mintPrice New mint price
    function setMintPrice(uint256 mintPrice) external;

    /// @dev Updates the treasury receiver
    /// @param newTreasuryReceiver New treasury receiver
    function setTreasuryReceiver(address newTreasuryReceiver) external;

    /// @dev Returns the metadata URI for a token
    /// @param tokenId The token ID
    /// @return The metadata URI
    function tokenURI(uint256 tokenId) external view returns (string memory);

    /// @dev Pauses all minting
    function pause() external;

    /// @dev Unpauses all minting
    function unpause() external;
}

